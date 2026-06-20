import { Observable } from "../lib/observable";
import { silkgoAuth } from "../api-clients/SilkgoAuthClient";
import { DEFAULT_LANG, LS_SESSION } from "../models/config";
import { ApiTokenResponse } from "../models/api-models";

export interface ViewerSession {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number; // epoch seconds
  isGuest: boolean;
  lastChannelId: string | null;
  language: string;
}

const empty: ViewerSession = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
  isGuest: true,
  lastChannelId: null,
  language: DEFAULT_LANG,
};

function load(): ViewerSession {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch (e) {
    return { ...empty };
  }
}

class SessionStore {
  readonly state = new Observable<ViewerSession>(load());

  private persist() {
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify(this.state.value));
    } catch (e) {
      /* storage may be unavailable; non-fatal */
    }
  }

  private apply(token: ApiTokenResponse) {
    const now = Math.floor(Date.now() / 1000);
    this.state.update((s) => ({
      ...s,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || s.refreshToken,
      expiresAt: now + (token.expires_in || 0),
      isGuest: true,
    }));
    this.persist();
  }

  private isValid() {
    const s = this.state.value as ViewerSession;
    const now = Math.floor(Date.now() / 1000);
    // 60s skew so we refresh slightly early.
    return !!s.accessToken && s.expiresAt - 60 > now;
  }

  // Reuse-while-valid → refresh → re-mint guest (R6).
  async ensureToken(): Promise<string> {
    if (this.isValid()) return this.state.value!.accessToken as string;
    const s = this.state.value as ViewerSession;
    if (s.refreshToken) {
      try {
        this.apply(await silkgoAuth.refresh(s.refreshToken));
        return this.state.value!.accessToken as string;
      } catch (e) {
        /* fall through to guest mint */
      }
    }
    this.apply(await silkgoAuth.mintGuestToken());
    return this.state.value!.accessToken as string;
  }

  // Force a refresh-or-remint after a 401 from a downstream call.
  async forceRefresh(): Promise<string> {
    this.state.update((s) => ({ ...s, expiresAt: 0 }));
    return this.ensureToken();
  }

  setLastChannel(channelId: string) {
    this.state.update((s) => ({ ...s, lastChannelId: channelId }));
    this.persist();
  }
}

export const sessionStore = new SessionStore();
