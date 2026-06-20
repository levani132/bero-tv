import { AbstractClient } from "./AbstractClient";
import { sessionStore } from "../stores/sessionStore";
import { timeService } from "../services/TimeService";
import { LIVETV_API } from "../models/config";
import {
  JsonApiList,
  JsonApiOne,
  ApiChannelAttrs,
  ApiChunkAttrs,
  ApiProgramAttrs,
  ApiServerTimeAttrs,
} from "../models/api-models";

// Live-TV client over api-new.silkgo.ge/api/v1 (guest bearer). VERIFIED working:
// channels, stream (channel/chunk), EPG, DVR gaps, server-time.
export class SilkgoTvClient extends AbstractClient {
  private async authHeaders(): Promise<Record<string, string>> {
    const token = await sessionStore.ensureToken();
    return { Authorization: "Bearer " + token, "X-APP-GUEST": "true", "Accept-Language": "ka" };
  }

  // GET with one transparent refresh-and-retry on 401 (FR-002).
  private async authedGet<T>(path: string): Promise<T> {
    const url = LIVETV_API + path;
    try {
      return await this.get<T>(url, await this.authHeaders());
    } catch (e: any) {
      if (e && e.status === 401) {
        await sessionStore.forceRefresh();
        return await this.get<T>(url, await this.authHeaders());
      }
      throw e;
    }
  }

  getServerTime(): Promise<JsonApiOne<ApiServerTimeAttrs>> {
    return this.authedGet<JsonApiOne<ApiServerTimeAttrs>>("/applicationinfo/server-time");
  }

  // The full live channel catalog (type=tv).
  getChannels(): Promise<JsonApiList<ApiChannelAttrs>> {
    return this.authedGet<JsonApiList<ApiChannelAttrs>>("/channel?type=tv");
  }

  // Live HLS URL for a channel — channel/chunk/{slug} → attributes.file.
  async getLiveStreamUrl(slug: string): Promise<string> {
    const r = await this.authedGet<JsonApiOne<ApiChunkAttrs>>("/channel/chunk/" + slug);
    return (r && r.data && r.data.attributes && r.data.attributes.file) || "";
  }

  // Catch-up (time-shift) stream for a past position. VERIFIED: channel/chunk with
  // `datetime=<Asia/Tbilisi YYYY-MM-DD HH:mm:ss>&center=false&allowProgressive=true`
  // returns a non-live windowed archive playlist (index-{startTs}-{duration}.m3u8).
  async getCatchupStreamUrl(slug: string, startEpoch: number): Promise<string> {
    const datetime = timeService.toLocalString(startEpoch); // source-local time
    const q =
      "/channel/chunk/" + slug +
      "?datetime=" + encodeURIComponent(datetime) +
      "&center=false&allowProgressive=true";
    const r = await this.authedGet<JsonApiOne<ApiChunkAttrs>>(q);
    const a = (r && r.data && r.data.attributes) || ({} as ApiChunkAttrs);
    return a.live === false && a.file ? a.file : "";
  }

  // EPG for a channel over a date range (date-only "YYYY-MM-DD"). VERIFIED: the
  // endpoint keys off startDate/endDate (date-only) to select whole days; the
  // datetime variants are ignored and always return today.
  getPrograms(channelId: string, startDate: string, endDate: string): Promise<JsonApiList<ApiProgramAttrs>> {
    const q =
      "/programs?channelId=" + encodeURIComponent(channelId) +
      "&shift=enabled&thumbs=enabled" +
      "&startDate=" + encodeURIComponent(startDate) +
      "&endDate=" + encodeURIComponent(endDate);
    return this.authedGet<JsonApiList<ApiProgramAttrs>>(q);
  }

  // DVR availability gaps for a channel (empty ranges = full catch-up available).
  getDvrGaps(slug: string, from: string, to: string): Promise<JsonApiOne<any>> {
    return this.authedGet<JsonApiOne<any>>(
      "/channel/" + slug + "/dvr-gaps?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to)
    );
  }
}

export const silkgoTv = new SilkgoTvClient();
