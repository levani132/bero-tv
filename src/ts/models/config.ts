// Hosts, client ids, and constants. Values observed in the silkgo/tv-new bundles
// (api-research.md) — observed, not contractual; confirm against live GE traffic.

export const SILKGO_HOST = "https://api-new.silkgo.ge";
export const SILKGO_API = SILKGO_HOST + "/api/v1";
// Live TV is served by silkgo's own backend (api-new.silkgo.ge), NOT Tvibo.
// Tvibo (api.tvibo.com) is abandoned/dead — verified 2026-06-21.
export const LIVETV_API = SILKGO_API;

export const GUEST_CLIENT_ID = "7"; // X-APP-GUEST client
export const USER_CLIENT_ID = "11"; // logged-in client (used for refresh)

export const DEFAULT_LANG = "ka";

// EPG / now-next refresh cadence (ms) — clarified ~5 min.
export const EPG_REFRESH_MS = 5 * 60 * 1000;
// Server-time resync cadence.
export const TIME_SYNC_MS = 30 * 60 * 1000;
// Debounce window for rapid channel changes (FR-019).
export const ZAP_DEBOUNCE_MS = 400;

// localStorage keys.
export const LS_SESSION = "berotv.session";
