// Corrects TV-clock drift using the source server-time, and handles the source's
// Asia/Tbilisi local timestamps in the EPG (R5). "Now" everywhere should come from
// TimeService.now(), and program time strings must go through parseLocal().
function parseUtc(s: string): number {
  // "YYYY-MM-DD HH:mm:ss" interpreted as UTC wall-clock → ms
  return Date.parse(s.replace(" ", "T") + "Z");
}
function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

class TimeService {
  private offsetMs = 0; // device clock drift (server - device)
  private tzOffsetMs = 0; // source local tz ahead of UTC (Tbilisi = +4h)

  // serverEpochSeconds + the server's local "YYYY-MM-DD HH:mm:ss" dateTime.
  syncFrom(serverEpochSeconds: number, dateTime?: string) {
    if (serverEpochSeconds && serverEpochSeconds > 0) {
      this.offsetMs = serverEpochSeconds * 1000 - Date.now();
      if (dateTime) this.tzOffsetMs = parseUtc(dateTime) - serverEpochSeconds * 1000;
    }
  }

  // Current corrected time, epoch seconds.
  now(): number {
    return Math.floor((Date.now() + this.offsetMs) / 1000);
  }

  // Convert a source-local program time string → epoch seconds.
  parseLocal(s: string): number {
    if (!s) return 0;
    return Math.floor((parseUtc(s) - this.tzOffsetMs) / 1000);
  }

  // Format an epoch → source-local "YYYY-MM-DD HH:mm:ss" (for EPG query windows).
  toLocalString(epochSeconds: number): string {
    const d = new Date(epochSeconds * 1000 + this.tzOffsetMs);
    return (
      d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
      " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds())
    );
  }

  // Short HH:mm for display, from a source-local time string.
  hhmm(localStr: string): string {
    const d = new Date(parseUtc(localStr));
    return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
  }
}

export const timeService = new TimeService();
