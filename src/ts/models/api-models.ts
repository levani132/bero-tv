// Raw API shapes for api-new.silkgo.ge/api/v1 (JSON:API style). VERIFIED 2026-06-21
// against live traffic. Live TV is served here, not by Tvibo.

export interface ApiTokenResponse {
  token_type: string; // "Bearer"
  expires_in: number; // seconds (guest: 86400)
  access_token: string; // RS256 JWT
  refresh_token?: string;
}

// Generic JSON:API node + envelope.
export interface JsonApiNode<A = any> {
  type: string;
  id: string | null;
  attributes: A;
  relationships?: any;
}
export interface JsonApiList<A = any> {
  data: JsonApiNode<A>[];
}
export interface JsonApiOne<A = any> {
  data: JsonApiNode<A>;
}

// GET /channel?type=tv
export interface ApiChannelAttrs {
  slug: string;
  type: string; // "tv"
  status: string; // "enabled"
  sort: number; // display order / channel number
  name: string;
  description?: string;
  recordingDuration?: number; // seconds of available DVR
  hasEPG?: boolean;
  rewindAllowed?: boolean;
  canCut?: boolean;
  allowed?: boolean;
  ratio?: string;
}

// GET /channel/chunk/{slug}
export interface ApiChunkAttrs {
  startTs?: number;
  endTs?: number | null;
  seek?: number;
  live?: boolean;
  file?: string; // HLS .m3u8 URL (tokenized, itdc.ge CDN)
}

// GET /programs?channelId=...
export interface ApiProgramAttrs {
  channelId: string;
  name: string;
  description?: string | null;
  startTime: string; // "YYYY-MM-DD HH:mm:ss"
  finishTime: string;
  thumbMp4?: string;
}

// GET /applicationinfo/server-time
export interface ApiServerTimeAttrs {
  timestamp: number;
  dateTime?: string;
}

// GET /channel/{slug}/dvr-gaps
export interface ApiDvrGapsAttrs {
  channelId?: string;
  slug?: string;
  ranges?: Array<{ start: string; stop: string }>;
}
