export interface DvrWindow {
  startsAt: number; // epoch seconds — earliest playable point
  durationSec: number;
}

export interface Channel {
  id: string; // UUID (used for EPG channelId)
  slug: string; // stream/dvr key (e.g. "silk_sport4")
  number: number;
  name: string;
  logoUrl: string;
  categoryIds: string[];
  hasCatchup: boolean;
  dvrWindow: DvrWindow | null;
  nowTitle: string | null; // current program title for the list (FR-004)
}

export interface Category {
  id: string;
  name: string;
  channelCount: number;
}
