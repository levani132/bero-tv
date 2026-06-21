import { Channel } from "../models/channel";
import { esc } from "../lib/renderer";
import { t } from "../lib/i18n";
import { epgStore } from "../stores/epgStore";

// Vertical channel-list overlay with windowed rendering (~142 channels → only the
// visible slice is in the DOM, R4). Owns its focus index; the player page drives it
// via key intents and reads the confirmed channel. now-playing titles are lazy-
// loaded per visible row from the (cached) EPG store.
const WINDOW = 9; // visible rows + small buffer

class ChannelList {
  private channels: Channel[] = [];
  private focusIndex = 0;
  private start = 0;
  private container: HTMLElement | null = null;
  private fetching: Record<string, boolean> = {};

  open(container: HTMLElement, channels: Channel[], focusId: string | null) {
    this.container = container;
    this.channels = channels;
    this.focusIndex = Math.max(0, channels.findIndex((c) => c.id === focusId));
    if (this.focusIndex < 0) this.focusIndex = 0;
    this.start = Math.max(0, Math.min(this.focusIndex - 1, channels.length - WINDOW));
    this.render();
  }

  close() {
    if (this.container) this.container.innerHTML = "";
  }

  move(delta: number) {
    const n = this.channels.length;
    if (!n) return;
    this.focusIndex = (this.focusIndex + delta + n) % n;
    if (this.focusIndex < this.start) this.start = this.focusIndex;
    else if (this.focusIndex >= this.start + WINDOW) this.start = this.focusIndex - WINDOW + 1;
    this.start = Math.max(0, Math.min(this.start, Math.max(0, n - WINDOW)));
    this.render();
  }

  focusedChannel(): Channel | undefined {
    return this.channels[this.focusIndex];
  }

  private render() {
    if (!this.container) return;
    const slice = this.channels.slice(this.start, this.start + WINDOW);
    const rows = slice
      .map((c, i) => {
        const focused = this.start + i === this.focusIndex ? " focused" : "";
        const logo = c.logoUrl ? '<img class="channel-row__logo" src="' + esc(c.logoUrl) + '">' : '<span class="channel-row__logo"></span>';
        const now = c.nowTitle ? '<span class="channel-row__now">' + esc(c.nowTitle) + "</span>" : '<span class="channel-row__now">' + t("epg.none") + "</span>";
        return (
          '<div class="channel-row' + focused + '">' +
          '<span class="channel-row__num">' + esc(c.number || "") + "</span>" +
          logo +
          '<span class="channel-row__meta"><span class="channel-row__name">' + esc(c.name) + "</span>" + now + "</span>" +
          "</div>"
        );
      })
      .join("");
    this.container.innerHTML =
      '<div class="channel-list__header"><span>⌕ ' + t("search") + "</span><span>▸ " + t("category") + "</span></div>" +
      '<div class="channel-list__viewport">' + rows + "</div>";
    this.loadNowTitles(slice);
  }

  // Lazy-load the now-playing title for each visible channel (EPG store is cached);
  // re-render as they arrive. nowTitle: null = not fetched, "" = fetched/none.
  private loadNowTitles(slice: Channel[]) {
    var self = this;
    slice.forEach(function (c) {
      if (c.nowTitle != null || self.fetching[c.id]) return;
      self.fetching[c.id] = true;
      epgStore
        .getNowNext(c.id)
        .then(function (nn) {
          c.nowTitle = nn.now ? nn.now.title : "";
          if (self.container) self.render();
        })
        .catch(function () {
          c.nowTitle = "";
        });
    });
  }
}

export function createChannelList() {
  return new ChannelList();
}
