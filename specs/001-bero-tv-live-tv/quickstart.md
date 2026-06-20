# Quickstart & Validation: Bero TV

**Date**: 2026-06-21 · How to build, run, and prove the feature works end-to-end. References [data-model.md](./data-model.md), [contracts/](./contracts/), and [plan.md](./plan.md). **All live-TV steps require a Georgian network** (api.tvibo.com is geo-locked).

## Prerequisites
- Node + gulp toolchain (as bero-movies): `npm install`.
- Tizen Studio (for `.wgt` packaging / TV emulator) and/or Android Studio (Android TV leanback emulator).
- A network in Georgia (VPN/VPS/residential) for any Tvibo/stream calls.

## Build & run
```bash
npm run build     # gulp: TS→dist/js, css/images, tizen webapp
npm run start     # gulp watch + live server on dist/ (browser dev)
```
- Browser dev: open the served `dist/` — keyboard arrows emulate the D-pad.
- Tizen: package `tizen/` → install `.wgt` on TV/emulator.
- Android TV: build `android/` WebView host → install on leanback emulator.

## Gate 0 — Integration smoke test (FIRST, on a GE network) ⚠
Proves the riskiest unknown (R2 token handoff) before any UI work.
```bash
# 1. mint guest token (verified working)
curl -s -X POST https://api-new.silkgo.ge/api/v1/auth/token \
  -H 'Content-Type: application/json' -H 'X-APP-GUEST: true' \
  -d '{"grant_type":"client_implicit","client_id":"7"}'      # → {access_token,...}
# 2. hit Tvibo with that bearer (UNVERIFIED — this is the test)
curl -s https://api.tvibo.com/api/applicationinfo/server-time -H "Authorization: Bearer <token>"
curl -s "https://api.tvibo.com/api/channel" -H "Authorization: Bearer <token>"
```
**Expected**: 200 + JSON channel list. **If 401** → switch `TviboClient` to the brokered-exchange path (research R2).

## End-to-end validation scenarios (map to spec)

| # | Scenario | Steps | Expected (SC) |
|---|----------|-------|---------------|
| 1 | Cold launch → resume | Launch app | Last channel resumes playing; first-run shows channel list. List visible <4s (SC-001) |
| 2 | Browse + play (US1) | Open channel list, D-pad to a channel, OK | Stream plays full-screen <5s; focus highlighted (SC-001) |
| 3 | Number entry (FR-008a) | Type `1``2` on keypad | Jumps to channel 12 via overlay |
| 4 | Zap + now/next (US2) | Up/Down between channels | Stream switches <3s; info bar shows now/next (SC-004, SC-006) |
| 5 | Rewind / time-shift (US3) | Press Left / Rewind on a DVR channel | Enters timeshift, "behind live" badge + scrubber; rewind shows position <3s (SC-008) |
| 6 | Catch-up a past program (US3) | Open program timeline, OK a past DVR program | Plays from its start <5s (SC-008) |
| 7 | Return to live (US3) | Press Back / Jump-to-Live while timeshifted | Live edge resumes <3s (SC-009) |
| 8 | Catch-up unavailable | OK a past program on a non-DVR channel | Clear "unavailable" message, stays navigable (FR-012) |
| 9 | Full guide (FR-011) | Open guide, scroll time/channels | Grid spans DVR-start→tomorrow, live edge marked |
| 10 | Category + search (US4) | Filter by category; search a keyword | Filtered list; results with channel+time (FR-013/14) |
| 11 | Failure isolation (FR-017) | Force EPG/search/one-stream failure | Placeholder shown; other channels still browse/play (SC-007) |
| 12 | Network drop + standby | Drop network then restore; sleep/wake TV | Retry affordance, recovers without force-quit (SC-005) |
| 13 | Dual-platform (SC-003) | Run scenarios 1–7 on Tizen **and** Android TV | Fully operable via remote on both from one build |

## Definition of done (this feature)
- Gate 0 passes on a GE network (token handoff confirmed or broker path implemented).
- Scenarios 1–13 pass on both Tizen and Android TV emulators/devices.
- Unit tests green for transformers, time-offset/rollover, and DVR-window availability.
