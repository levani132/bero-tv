import { router } from "../lib/router";
import { t } from "../lib/i18n";
import { resolveKey, digitOf } from "../services/KeyService";
import { playerService } from "../services/PlayerService";
import { channelsStore } from "../stores/channelsStore";
import { sessionStore } from "../stores/sessionStore";
import { silkgoTv } from "../api-clients/SilkgoTvClient";
import { createChannelList } from "../components/channel-list";
import { createNumberEntry } from "../components/number-entry";
import { renderInfoBar } from "../components/info-bar";
import { createProgramTimeline } from "../components/program-timeline";
import { renderTransport } from "../components/transport-bar";
import { epgStore } from "../stores/epgStore";
import { timeService } from "../services/TimeService";
import { Channel } from "../models/channel";
import { ZAP_DEBOUNCE_MS } from "../models/config";

// Player-first home (User Stories 1 + 2 surface). Boots into the resumed channel
// and layers overlays over live video. Time-shift overlays (US3) plug in later.
export function Player() {
  const list = createChannelList();
  const numberEntry = createNumberEntry();
  const timeline = createProgramTimeline();
  let mode: "playing" | "list" | "timeline" = "playing";
  let currentId: string | null = null;
  let timeshift = false;
  let zapTimer: any = null;
  let infoTimer: any = null;
  let seekStep = 5; // seconds; accelerates while the key repeats
  let lastSeekAt = 0;
  let seekActive = false; // previewing an uncommitted seek
  let tsStartEpoch: number | null = null; // start of the loaded time-shift window; null = pure live
  let targetEpoch = 0; // seek target, epoch seconds
  let commitTimer: any = null;
  let hideTimer: any = null;
  let pollTimer: any = null;

  function el(id: string) {
    return document.getElementById(id) as HTMLElement;
  }

  function showState(msgKey: string | null, withRetry: boolean) {
    const node = el("state-overlay");
    if (!node) return;
    node.innerHTML = msgKey
      ? '<div class="state"><div class="state__msg">' + t(msgKey) + "</div>" +
        (withRetry ? '<div class="state__retry">' + t("retry") + "</div>" : "") + "</div>"
      : "";
  }

  // now/next info bar — shown on every channel change, auto-hidden after ~5s (US2).
  function showInfoBar(ch: Channel) {
    const node = el("info-bar-overlay");
    if (!node) return;
    node.innerHTML = renderInfoBar(ch, { now: null, next: null });
    epgStore.getNowNext(ch.id).then((nn) => {
      // Only repaint if still on this channel AND no overlay has taken over.
      if (currentId === ch.id && mode === "playing") node.innerHTML = renderInfoBar(ch, nn);
    });
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => {
      if (mode === "playing") node.innerHTML = "";
    }, 5000);
  }

  // Debounced playback so rapid zapping doesn't stack stream requests (FR-019).
  function playChannel(ch: Channel) {
    if (!ch) return;
    currentId = ch.id;
    timeshift = false;
    seekActive = false;
    tsStartEpoch = null;
    clearTimeout(commitTimer);
    clearTimeout(hideTimer);
    clearInterval(pollTimer);
    el("timeshift-overlay").innerHTML = "";
    sessionStore.setLastChannel(ch.id);
    showInfoBar(ch);
    showState("loading", false);
    clearTimeout(zapTimer);
    zapTimer = setTimeout(async () => {
      try {
        const url = await silkgoTv.getLiveStreamUrl(ch.slug);
        if (!url) return showState("error.stream", true);
        playerService.playLive(url);
        showState(null, false);
      } catch (e: any) {
        const kind = e && e.status === 403 ? "error.geo" : "error.stream";
        showState(kind, true);
      }
    }, ZAP_DEBOUNCE_MS);
  }

  function zap(delta: number) {
    const idx = currentId ? channelsStore.indexOf(currentId) : -1;
    const all = channelsStore.state.value!.channels;
    if (!all.length) return;
    const next = all[(idx + delta + all.length) % all.length];
    playChannel(next);
  }

  function hideInfoBar() {
    clearTimeout(infoTimer);
    el("info-bar-overlay").innerHTML = "";
  }

  function openList() {
    mode = "list";
    hideInfoBar(); // don't let the info bar bleed under the list (overlap fix)
    el("channel-list-overlay").classList.add("channel-list");
    list.open(el("channel-list-overlay"), channelsStore.state.value!.channels, currentId);
  }

  function closeList() {
    mode = "playing";
    list.close();
    el("channel-list-overlay").classList.remove("channel-list");
  }

  // Program timeline (US3 catch-up entry).
  async function openTimeline() {
    if (!currentId) return;
    const ch = channelsStore.getById(currentId);
    if (!ch) return;
    mode = "timeline";
    hideInfoBar();
    const node = el("timeline-overlay");
    node.classList.add("timeline-panel");
    node.innerHTML = '<div class="state__msg">' + t("loading") + "</div>";
    const programs = await epgStore.getSchedule(ch.id);
    if (mode !== "timeline") return; // user moved on while loading
    timeline.open(node, ch, programs);
  }

  function closeTimeline() {
    mode = "playing";
    timeline.close();
    el("timeline-overlay").classList.remove("timeline-panel");
  }

  // Attempt catch-up of a past program; degrade gracefully if unavailable (FR-012).
  async function playCatchup(ch: Channel, startEpoch: number) {
    showState("loading", false);
    try {
      const url = await silkgoTv.getTimeshiftStreamUrl(ch.slug, startEpoch);
      if (!url) {
        showState("catchup.unavailable", false);
        setTimeout(() => showState(null, false), 2500);
        return;
      }
      playerService.playLive(url); // windowed [startEpoch, live] stream
      tsStartEpoch = startEpoch;
      timeshift = true;
      showState(null, false);
      setTimeout(showTransport, 1200); // let the stream prepare so position is known
    } catch (e) {
      showState("catchup.unavailable", false);
      setTimeout(() => showState(null, false), 2500);
    }
  }

  // --- Transport / scrub bar (text + progress line; "behind live") ---
  // Current playback time as an epoch: live edge when no window is loaded, else
  // the window start plus how far into it we've played.
  function currentEpoch(): number {
    if (tsStartEpoch == null) return timeService.now();
    return tsStartEpoch + Math.floor(playerService.getCurrentMs() / 1000);
  }
  function renderTransportBar(behindMs: number) {
    el("timeshift-overlay").innerHTML = renderTransport(behindMs);
  }
  function behindNowMs(): number {
    return Math.max(0, (timeService.now() - currentEpoch()) * 1000);
  }
  function startPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (seekActive) return; // a preview is on screen; don't overwrite it
      renderTransportBar(behindNowMs());
    }, 700);
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTransport, 5000);
  }
  function hideTransport() {
    clearInterval(pollTimer);
    el("timeshift-overlay").innerHTML = "";
  }
  // Show the bar for current playback (used when catch-up starts).
  function showTransport() {
    renderTransportBar(behindNowMs());
    startPoll();
    scheduleHide();
  }

  // Accumulate a behind-live target while the key repeats, preview it on the scrub
  // bar, and commit once after a short pause. dir: -1 = back (Left), +1 = fwd.
  // Step accelerates 5→10→20→40→60s. The source has no deep buffer at the live
  // edge, so rewinding loads a windowed stream starting at the target time.
  function doSeek(dir: number) {
    var now = timeService.now();
    if (!seekActive) {
      targetEpoch = currentEpoch();
      seekActive = true;
    }
    var t = Date.now();
    seekStep = t - lastSeekAt < 800 ? Math.min(seekStep * 2, 60) : 5;
    lastSeekAt = t;
    targetEpoch += dir * seekStep;
    if (targetEpoch > now) targetEpoch = now; // can't pass the live edge
    if (targetEpoch < now - 6 * 3600) targetEpoch = now - 6 * 3600; // cap 6h back
    timeshift = now - targetEpoch > 3;
    renderTransportBar(Math.max(0, (now - targetEpoch) * 1000));
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commitSeek, 450);
    scheduleHide();
  }
  async function commitSeek() {
    seekActive = false;
    var now = timeService.now();
    if (now - targetEpoch <= 3) {
      returnToLive();
      return;
    }
    // Target inside the already-loaded window → smooth seek, no reload.
    if (tsStartEpoch != null && targetEpoch >= tsStartEpoch) {
      playerService.seekTo((targetEpoch - tsStartEpoch) * 1000);
      startPoll();
      return;
    }
    // Otherwise (from live, or earlier than the window) → load a windowed stream
    // starting at the target and play from there.
    if (!currentId) return;
    var ch = channelsStore.getById(currentId);
    if (!ch) return;
    try {
      var url = await silkgoTv.getTimeshiftStreamUrl(ch.slug, targetEpoch);
      if (url) {
        playerService.playLive(url);
        tsStartEpoch = targetEpoch;
        timeshift = true;
        startPoll();
      }
    } catch (e) {}
  }

  // Return to the live edge (one press — SC-009).
  function returnToLive() {
    timeshift = false;
    seekActive = false;
    tsStartEpoch = null;
    clearTimeout(commitTimer);
    clearTimeout(hideTimer);
    clearInterval(pollTimer);
    el("timeshift-overlay").innerHTML = "";
    var ch = currentId ? channelsStore.getById(currentId) : undefined;
    if (ch) playChannel(ch);
  }

  function onKey(e: KeyboardEvent) {
    const key = resolveKey(e);
    if (key === "DIGIT") {
      numberEntry.pushDigit(digitOf(e));
      return;
    }
    // Channel Up/Down: switch channel directly from any context (closes panes).
    if (key === "CHANNEL_UP" || key === "CHANNEL_DOWN") {
      if (mode === "list") closeList();
      else if (mode === "timeline") closeTimeline();
      zap(key === "CHANNEL_UP" ? 1 : -1);
      return;
    }
    // Dedicated Channel List key toggles the channel list from anywhere.
    if (key === "CHANNEL_LIST") {
      if (mode === "timeline") closeTimeline();
      if (mode === "list") closeList();
      else openList();
      return;
    }
    if (mode === "list") {
      if (key === "UP") list.move(-1);
      else if (key === "DOWN") list.move(1);
      else if (key === "OK" || key === "RIGHT") {
        const ch = list.focusedChannel();
        closeList();
        // Already on this channel → just close; don't restart the stream.
        if (ch && ch.id !== currentId) playChannel(ch);
      } else if (key === "BACK" || key === "LEFT") closeList();
      return;
    }
    if (mode === "timeline") {
      if (key === "UP" || key === "LEFT") timeline.move(-1);
      else if (key === "DOWN" || key === "RIGHT") timeline.move(1);
      else if (key === "OK") {
        const row = timeline.focused();
        const ch = currentId ? channelsStore.getById(currentId) : undefined;
        closeTimeline();
        if (row && ch) {
          if (row.state === "live") returnToLive();
          else if (row.playable) playCatchup(ch, row.program.startsAt);
          else { showState("catchup.unavailable", false); setTimeout(() => showState(null, false), 2500); }
        }
      } else if (key === "BACK") closeTimeline();
      return;
    }
    // bare player:
    //  OK → channel chooser; but if the status bar is up → program chooser
    //  Up/Down → now/next status bar
    //  Left/Right (+ media Rewind/Forward) → seek back/forward (accelerating)
    //  Channel Up/Down zap directly; Back → live (if shifted) / exit
    if (key === "OK") {
      var infoUp = el("info-bar-overlay").innerHTML !== "";
      if (infoUp) openTimeline();
      else openList();
    } else if (key === "UP" || key === "DOWN") {
      var cur = currentId ? channelsStore.getById(currentId) : undefined;
      if (cur) showInfoBar(cur);
    } else if (key === "LEFT" || key === "REWIND") doSeek(-1);
    else if (key === "RIGHT" || key === "FORWARD") doSeek(1);
    else if (key === "BACK") {
      if (timeshift) returnToLive();
      else router.goBack();
    }
  }

  async function boot() {
    try {
      await sessionStore.ensureToken();
    } catch (e) {
      return showState("error.guest", true);
    }
    await channelsStore.load();
    const st = channelsStore.state.value!;
    if (st.error) return showState(st.error, true);
    if (!st.channels.length) return showState("epg.none", true);
    const resumeId = sessionStore.state.value!.lastChannelId;
    const resume = (resumeId && channelsStore.getById(resumeId)) || st.channels[0];
    playChannel(resume);
    if (!resumeId) openList(); // first run: surface the list
  }

  // @ts-ignore — static lifecycle hooks consumed by the router
  Player.mount = function () {
    numberEntry.attach(el("number-entry-overlay"), (num) => {
      const ch = channelsStore.byNumber(num);
      if (ch) {
        if (mode === "list") closeList();
        if (ch.id !== currentId) playChannel(ch);
        else showInfoBar(ch);
      }
    });
    playerService.attach(el("player-video") as HTMLVideoElement, {
      onError: () => showState("error.stream", true),
    });
    document.addEventListener("keydown", onKey);
    boot();
  };

  // @ts-ignore
  Player.destructor = function () {
    document.removeEventListener("keydown", onKey);
    playerService.stop();
  };

  return (
    '<div class="player">' +
    '<video id="player-video" preload="auto"></video>' +
    '<div id="channel-list-overlay"></div>' +
    '<div id="timeline-overlay"></div>' +
    '<div id="info-bar-overlay"></div>' +
    '<div id="timeshift-overlay"></div>' +
    '<div id="number-entry-overlay"></div>' +
    '<div id="state-overlay"></div>' +
    "</div>"
  );
}
