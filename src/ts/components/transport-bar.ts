import { t } from "../lib/i18n";

// Scrub/transport bar (ui-ux-plan §5.4) — text + a progress line, no icons.
// Mirrors bero-movies' progress-bar idea (current / duration + a fill), adapted
// for AVPlay catch-up archives where duration is known.
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

// posMs = preview/playback position; durMs = total seekable (0 = live edge).
export function renderTransport(posMs: number, durMs: number): string {
  var hasDuration = durMs > 0;
  var pct = hasDuration ? Math.max(0, Math.min(100, (posMs / durMs) * 100)) : 100;
  var label = hasDuration ? fmtTime(posMs) + " / " + fmtTime(durMs) : t("live");
  return (
    '<div class="transport">' +
    '<div class="transport__time">' + label + "</div>" +
    '<div class="transport__bar"><div class="transport__fill" style="width:' + pct + '%">' +
    '<span class="transport__thumb"></span></div></div>' +
    "</div>"
  );
}
