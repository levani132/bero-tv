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
    if (!this.useAvplay) {
      video.onerror = () => events.onError && events.onError("unplayable");
      video.oncanplay = () => events.onReady && events.onReady();
    }
  }

  // Play a live HLS url full-screen.
  playLive(url: string) {
    if (this.useAvplay) {
      try {
        webapis.avplay.close();
      } catch (e) {}
      webapis.avplay.open(url);
      webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
      webapis.avplay.prepareAsync(
        () => webapis.avplay.play(),
        () => {}
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

  // --- Reserved for User Story 3 (time-shift) ---
  // seekTo(positionSec) / jump(deltaSec) / jumpToLive() — AVPlay.seekTo / ExoPlayer.
}

export const playerService = new PlayerService();
