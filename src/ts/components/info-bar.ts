import { Channel } from "../models/channel";
import { NowNext } from "../models/program";
import { esc } from "../lib/renderer";
import { t } from "../lib/i18n";
import { timeService } from "../services/TimeService";

// Bottom now/next info bar (ui-ux-plan §5.1). Auto-hidden by the player after a few
// seconds; updated on every channel change.
function progressPct(nn: NowNext): number {
  if (!nn.now) return 0;
  const span = nn.now.endsAt - nn.now.startsAt;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((timeService.now() - nn.now.startsAt) / span) * 100)));
}

function fmt(ts: number): string {
  return ts ? timeService.hhmm(timeService.toLocalString(ts)) : "";
}

export function renderInfoBar(channel: Channel, nn: NowNext, isLive: boolean): string {
  const logo = channel.logoUrl
    ? '<img class="channel-row__logo" src="' + esc(channel.logoUrl) + '">'
    : '<span class="channel-row__logo"></span>';
  let body: string;
  if (nn.now) {
    body =
      '<div class="info-now"><span class="info-now__time">' + fmt(nn.now.startsAt) + "–" + fmt(nn.now.endsAt) + "</span> " +
      '<span class="info-now__title">' + esc(nn.now.title) + "</span>" +
      '<span class="info-progress"><span class="info-progress__bar" style="width:' + progressPct(nn) + '%"></span></span></div>' +
      (nn.next ? '<div class="info-next">→ ' + fmt(nn.next.startsAt) + "  " + esc(nn.next.title) + "</div>" : "");
  } else {
    body = '<div class="info-now info-now--empty">' + t("epg.none") + "</div>";
  }
  var badge = isLive
    ? '<span class="badge-live">' + t("live") + "</span>"
    : '<span class="badge-behind">' + t("behindLive") + "</span>";
  return (
    '<div class="info-bar">' +
    '<div class="info-bar__head">' +
    '<span class="channel-row__num">' + esc(channel.number || "") + "</span>" +
    logo +
    '<span class="info-bar__name">' + esc(channel.name) + "</span>" +
    badge +
    "</div>" + body + "</div>"
  );
}
