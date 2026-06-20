export interface Stream {
  channelId: string;
  url: string; // HLS .m3u8
  mode: "live" | "timeshift";
  positionSec: number | null; // offset behind live edge when timeshift
  programId: string | null;
}
