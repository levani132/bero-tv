export interface Program {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  startsAt: number; // epoch seconds
  endsAt: number; // epoch seconds
  thumbUrl: string | null;
}

export interface NowNext {
  now: Program | null;
  next: Program | null;
}
