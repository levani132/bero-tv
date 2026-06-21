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

  // Relative seek within the current stream. On AVPlay this jumps within the
  // available buffer/DVR window (full range in a catch-up archive, limited near
  // the live edge); on <video> it nudges currentTime within the seekable range.
  seek(deltaSeconds: number) {
    if (this.useAvplay) {
      try {
        var ms = Math.abs(deltaSeconds) * 1000;
        if (deltaSeconds < 0) webapis.avplay.jumpBackward(ms);
        else webapis.avplay.jumpForward(ms);
      } catch (e) {}
      return;
    }
    if (this.videoEl) {
      try {
        var t = (this.videoEl.currentTime || 0) + deltaSeconds;
        this.videoEl.currentTime = t < 0 ? 0 : t;
      } catch (e) {}
    }
  }
}

export const playerService = new PlayerService();
