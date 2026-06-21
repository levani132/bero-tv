// Playback abstraction over Tizen AVPlay and HTML5 <video> (Android WebView /
// ExoPlayer host / web). Live playback is implemented here; time-shift seek is a
// reserved seam filled in User Story 3 (research R3). PlayerState lives in playerStore.
type PlayerEvents = { onError?: (kind: string) => void; onReady?: () => void };

class PlayerService {
  private videoEl: HTMLVideoElement | null = null;
  private useAvplay = false;

  // Attach to the <video id="player-video"> rendered by the player page.
  attach(video: HTMLVideoElement, events: PlayerEvents = {}) {
    this.videoEl = video;
    this.useAvplay = !!(window["webapis"] && webapis.avplay);
    if (this.useAvplay) {
      // Tizen AVPlay renders video to a hardware plane BEHIND the webview. The page
      // must be transparent for it to show through, and the unused <video> element
      // must not cover it — otherwise: audio plays but the screen is black.
      video.style.display = "none";
      try {
        document.documentElement.style.background = "transparent";
        document.body.style.background = "transparent";
        const parent = video.parentElement;
        if (parent) (parent as HTMLElement).style.background = "transparent";
      } catch (e) {}
    } else {
      video.onerror = () => events.onError && events.onError("unplayable");
      video.oncanplay = () => events.onReady && events.onReady();
    }
  }

  // Play a live HLS url full-screen.
  playLive(url: string) {
    if (this.useAvplay) {
      try {
        webapis.avplay.stop();
        webapis.avplay.close();
      } catch (e) {}
      webapis.avplay.open(url);
      try {
        webapis.avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_FULL_SCREEN");
      } catch (e) {}
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      webapis.avplay.prepareAsync(
        function () {
          webapis.avplay.play();
        },
        function () {}
      );
      return;
    }
    if (this.videoEl) {
      this.videoEl.src = url;
      this.videoEl.play().catch(() => {});
    }
  }

  stop() {
    if (this.useAvplay) {
      try {
        webapis.avplay.stop();
      } catch (e) {}
    } else if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute("src");
    }
  }

  // Current playback position, in ms.
  getCurrentMs(): number {
    if (this.useAvplay) {
      try {
        return webapis.avplay.getCurrentTime();
      } catch (e) {
        return 0;
      }
    }
    return this.videoEl ? Math.floor((this.videoEl.currentTime || 0) * 1000) : 0;
  }

  // Total seekable duration, in ms (0/unknown for a pure live edge).
  getDurationMs(): number {
    if (this.useAvplay) {
      try {
        return webapis.avplay.getDuration() || 0;
      } catch (e) {
        return 0;
      }
    }
    if (this.videoEl && isFinite(this.videoEl.duration)) {
      return Math.floor(this.videoEl.duration * 1000);
    }
    return 0;
  }

  // Absolute seek to a position (ms). Best players seek ONCE to a computed target
  // (debounced) rather than firing many relative jumps — avoids AVPlay thrashing.
  seekTo(ms: number) {
    var target = ms < 0 ? 0 : Math.round(ms);
    if (this.useAvplay) {
      try {
        webapis.avplay.seekTo(target);
      } catch (e) {}
      return;
    }
    if (this.videoEl) {
      try {
        this.videoEl.currentTime = target / 1000;
      } catch (e) {}
    }
  }
}

export const playerService = new PlayerService();
