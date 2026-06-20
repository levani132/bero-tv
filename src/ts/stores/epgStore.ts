import { silkgoTv } from "../api-clients/SilkgoTvClient";
import { timeService } from "../services/TimeService";
import { transformPrograms } from "../transformers/programTransformer";
import { Program, NowNext } from "../models/program";
import { EPG_REFRESH_MS } from "../models/config";

// Per-channel EPG cache with client-side now/next rollover (R5, FR-010). Programs
// are fetched once per channel for a window around "now" and re-fetched after the
// cache ages out (~5 min). Failure is isolated — callers get an empty NowNext.
interface Entry {
  programs: Program[];
  fetchedAt: number;
}

class EpgStore {
  private cache: Record<string, Entry> = {};

  private async ensure(channelId: string): Promise<Program[]> {
    const now = Date.now();
    const hit = this.cache[channelId];
    if (hit && now - hit.fetchedAt < EPG_REFRESH_MS) return hit.programs;
    const nowSec = timeService.now();
    // Fetch yesterday + today (date-only) so the timeline includes genuinely
    // archived programs (the source keeps a wide live window; true catch-up archive
    // starts several hours back, i.e. yesterday evening).
    const today = timeService.toLocalString(nowSec).slice(0, 10);
    const yesterday = timeService.toLocalString(nowSec - 24 * 3600).slice(0, 10);
    try {
      const resp = await silkgoTv.getPrograms(channelId, yesterday, today);
      const programs = transformPrograms(resp && resp.data);
      this.cache[channelId] = { programs, fetchedAt: now };
      return programs;
    } catch (e) {
      return hit ? hit.programs : [];
    }
  }

  // Full cached schedule (around now) for a channel — used by the program timeline.
  async getSchedule(channelId: string): Promise<Program[]> {
    return this.ensure(channelId);
  }

  // now/next for a channel, computed against corrected server time.
  async getNowNext(channelId: string): Promise<NowNext> {
    const programs = await this.ensure(channelId);
    const t = timeService.now();
    let now: Program | null = null;
    let next: Program | null = null;
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      if (p.startsAt <= t && t < p.endsAt) {
        now = p;
        next = programs[i + 1] || null;
        break;
      }
      if (p.startsAt > t) {
        next = p;
        break;
      }
    }
    return { now, next };
  }
}

export const epgStore = new EpgStore();
