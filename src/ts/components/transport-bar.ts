import { t } from "../lib/i18n";

// Scrub/transport bar (ui-ux-plan §5.4) — text + a progress line, no icons.
// Shows how far behind the live edge we are; the thumb sits at the right (live)
// and moves left as you rewind.
function two(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

export function fmtTime(ms: number): string {
  var s = Math.max(0, Math.floor(ms / 1000));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return (h > 0 ? h + ":" + two(m) : "" + m) + ":" + two(sec);
}

var MAX_BACK_MS = 2 * 3600 * 1000; // bar scale (2h)

// behindMs = how far behind the live edge (0 = live).
export function renderTransport(behindMs: number): string {
  var live = behindMs <= 3000;
  var label = live ? t("live") : "−" + fmtTime(behindMs) + "  ·  " + t("behindLive");
  var pct = live ? 100 : Math.max(4, 100 - (Math.min(behindMs, MAX_BACK_MS) / MAX_BACK_MS) * 100);
  return (
    '<div class="transport">' +
    '<div class="transport__time">' + label + "</div>" +
    '<div class="transport__bar"><div class="transport__fill" style="width:' + pct + '%">' +
    '<span class="transport__thumb"></span></div></div>' +
    "</div>"
  );
}
