# Phase 0 Research: Bero TV

**Date**: 2026-06-21 · Resolves the NEEDS CLARIFICATION items and records key technical decisions. Format: Decision / Rationale / Alternatives.

> Reachability caveat: `api.tvibo.com` is Georgia-only (verified — see api-research.md §3.3). Items marked **⚠ verify-in-GE** can only be confirmed on a Georgian network and are the first on-device tasks.

---

## R1 — OS / platform baselines

**Decision**: Tizen ≥ 2.3 (Samsung TV 2017+), `devel.api.version` 2.4, 1080p landscape; Android TV API 22+ (Lollipop, leanback), WebView host loading the shared web app. Mirror bero-movies' targets exactly.

**Rationale**: bero-movies already ships and runs on these baselines with the same vanilla-TS + AVPlay/WebView approach; matching them removes platform risk and reuses the packaging.

**Alternatives**: Newer-only baselines (smaller test matrix) — rejected; no reason to drop the install base bero-movies already supports.

---

## R2 — Live-TV backend & authorization ✅ RESOLVED (2026-06-21)

**Decision**: Use silkgo's own backend `api-new.silkgo.ge/api/v1` with the guest bearer (`client_implicit`, client_id 7) + `X-APP-GUEST: true`. **Tvibo is NOT used** — `api.tvibo.com` is abandoned/dead.

**Rationale**: Driving real Chromium (Playwright) against silkgo.ge/tv showed the live product calls `api-new.silkgo.ge/api/v1/*` directly (channels, programs, dvr-gaps, channel/chunk for stream), not Tvibo. The full chain was then replicated from a normal machine with curl — all 200s, HLS plays. The earlier "token handoff" risk and "Georgia geo-lock" were both artifacts of a **stale JS bundle** (it still referenced the dead `api.tvibo.com`) plus a missing `?type=tv` on the channel probe. CORS is `*`.

**Verified chain**: guest token → `GET /channel?type=tv` (142 channels) → `GET /channel/chunk/{slug}` (`attributes.file` = tokenized HLS) → `index.m3u8` plays. Shapes in [contracts/silkgo-tv.md](./contracts/silkgo-tv.md).

**No remaining integration risk for live playback.** Time-shift seek param (US3) is the only item still to confirm against live traffic.

---

## R3 — HLS live + time-shift playback (AVPlay vs ExoPlayer)

**Decision**: Abstract playback behind `PlayerService` with two implementations. **Tizen**: `webapis.avplay` (open → prepare → play; `avplay.seekTo`/`jumpForward`/`jumpBackward` for time-shift; STREAMING_PROPERTY for live). **Android**: defer seek/time-shift to the WebView host's ExoPlayer where available; `<video>` + a JS HLS shim only as fallback. Live edge vs. timeshift position is tracked in `playerStore`, not the player.

**Rationale**: AVPlay is the proven Tizen path (bero-movies uses native playback) and exposes the seek primitives time-shift needs. ExoPlayer handles HLS DVR windows natively on Android. Keeping live/timeshift state in the store lets the UI render the "behind live" badge and scrubber consistently across both players.

**Alternatives**: A single JS HLS library (hls.js) for both — rejected: heavy for TV SoCs, and native players already decode HLS hardware-accelerated. Tizen `<video>` without AVPlay — rejected: weaker seek/live control.

---

## R4 — Channel grid virtualization (~142 channels, low-power TV)

**Decision**: Windowed rendering — render only the visible rows plus a small overscan buffer, recycling DOM nodes as focus scrolls; channel logos lazy-loaded as rows enter the window. Focus model keys off the data index, not live DOM.

**Rationale**: 142 channels each with a logo + now-playing text is hundreds of nodes; full render tanks D-pad responsiveness on TV SoCs (clarified requirement). Windowing keeps the live DOM small and focus moves snappy, protecting SC-001/SC-004.

**Alternatives**: Full render (simple) — rejected on perf. Native list widgets — N/A in a web view.

---

## R5 — Server-time sync & now/next rollover

**Decision**: On startup (and periodically) call `applicationinfo/server-time`; store `offset = serverTime - deviceTime` in `TimeService`. Compute "now" as `Date.now() + offset`; derive current/next program from the cached per-channel schedule; schedule a timer at the current program's end to roll over locally. Refetch EPG every ~5 min and on channel change.

**Rationale**: TV device clocks drift; the source exposes server-time precisely for this. Local rollover keeps now/next second-accurate without polling the EPG endpoint (clarified decision), protecting SC-006.

**Alternatives**: Trust device clock — rejected (drift → wrong now/next). Frequent EPG polling — rejected (needless load, the source offers server-time for exactly this).

---

## R6 — Session persistence & transparent refresh

**Decision**: Persist `{accessToken, refreshToken, expiresAt, lastChannelId, language}` in `localStorage`. On launch, reuse a non-expired token; refresh (`grant_type=refresh_token`, client_id 11) in the background before expiry or on a 401; mint a fresh guest token only if no valid token/refresh exists. A 401 from Tvibo triggers one refresh-and-retry before surfacing an error.

**Rationale**: Removes a token round-trip from most cold starts (helps SC-001); matches the tv-new client's auto-refresh behavior; token carries no PII so local storage is acceptable.

**Alternatives**: Mint-every-launch — rejected (slower cold start). In-memory only — rejected (loses resume + adds round-trip).

---

## R7 — Failure isolation (FR-017)

**Decision**: One Observable store per capability (channels, epg, player, session); each fetch path has independent loading/error state. A failure in EPG/guide/search renders a local placeholder; the player and channel list keep working. Network/standby handled by retry affordances in each store.

**Rationale**: Directly implements FR-017/SC-007 — no single source-capability failure breaks the app.

**Alternatives**: Single global app state with one error boundary — rejected (one failure blanks everything).

---

## Resolved unknowns summary

| ID | Topic | Status |
|----|-------|--------|
| R1 | OS baselines | Resolved (Tizen 2.3+/Android 22+) |
| R2 | Tvibo token handoff | Direct-bearer first; ⚠ verify-in-GE (first on-device task) |
| R3 | HLS live + time-shift | AVPlay (Tizen) / ExoPlayer (Android) behind PlayerService |
| R4 | Grid virtualization | Windowed rendering + lazy logos |
| R5 | Time sync / rollover | server-time offset + local rollover |
| R6 | Session persistence | localStorage + transparent refresh |
| R7 | Failure isolation | per-capability Observable stores |

No unresolved NEEDS CLARIFICATION remain that block design. R2 remains an on-device verification (not a design blocker — the seam exists either way).
