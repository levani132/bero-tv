import { Program } from "../models/program";
import { Channel } from "../models/channel";
import { esc } from "../lib/renderer";
import { t } from "../lib/i18n";
import { timeService } from "../services/TimeService";

// Per-channel program timeline (ui-ux-plan §5.3) — the primary catch-up entry.
// Past programs within the DVR window are playable; live is marked; upcoming is
// shown but not selectable. Owns its own focus index; the player drives it.
export type ProgState = "past" | "live" | "upcoming";

export interface TimelineRow {
  program: Program;
  state: ProgState;
  playable: boolean; // past + within DVR window
}

function fmt(ts: number): string {
  return ts ? timeService.hhmm(timeService.toLocalString(ts)) : "";
}

class ProgramTimeline {
  private rows: TimelineRow[] = [];
  private focusIndex = 0;
  private container: HTMLElement | null = null;

  open(container: HTMLElement, channel: Channel, programs: Program[]) {
    this.container = container;
    const now = timeService.now();
    const dvrStart = channel.dvrWindow ? channel.dvrWindow.startsAt : Infinity;
    this.rows = programs.map((p) => {
      const state: ProgState = p.endsAt <= now ? "past" : p.startsAt <= now ? "live" : "upcoming";
      return {
        program: p,
        state,
        playable: state === "past" && channel.hasCatchup && p.startsAt >= dvrStart,
      };
    });
    // Focus the live program by default.
    const liveIdx = this.rows.findIndex((r) => r.state === "live");
    this.focusIndex = liveIdx >= 0 ? liveIdx : Math.max(0, this.rows.length - 1);
    this.render();
  }

  close() {
    if (this.container) this.container.innerHTML = "";
  }

  move(delta: number) {
    if (!this.rows.length) return;
    this.focusIndex = Math.max(0, Math.min(this.rows.length - 1, this.focusIndex + delta));
    this.render();
  }

  focused(): TimelineRow | undefined {
    return this.rows[this.focusIndex];
  }

  private render() {
    if (!this.container) return;
    // Window of rows around focus to keep the DOM small.
    const start = Math.max(0, Math.min(this.focusIndex - 3, this.rows.length - 7));
    const slice = this.rows.slice(start, start + 7);
    const items = slice
      .map((r, i) => {
        const idx = start + i;
        const cls =
          "timeline-item" +
          (idx === this.focusIndex ? " focused" : "") +
          (r.state === "live" ? " is-live" : "") +
          (r.state === "upcoming" || !r.playable && r.state === "past" ? " is-dim" : "");
        const badge =
          r.state === "live" ? '<span class="badge-live">' + t("live") + "</span>" :
          r.state === "past" && !r.playable ? '<span class="badge-behind">' + t("catchup.unavailable") + "</span>" : "";
        return (
          '<div class="' + cls + '">' +
          '<span class="timeline-item__time">' + fmt(r.program.startsAt) + "</span>" +
          '<span class="timeline-item__title">' + esc(r.program.title) + "</span>" +
          badge +
          "</div>"
        );
      })
      .join("");
    this.container.innerHTML = '<div class="timeline">' + items + "</div>";
  }
}

export function createProgramTimeline() {
  return new ProgramTimeline();
}
