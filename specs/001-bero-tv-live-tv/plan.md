# Implementation Plan: Bero TV — Live TV for Tizen & Android TV

**Branch**: `001-bero-tv-live-tv` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-bero-tv-live-tv/spec.md`

## Summary

Bero TV is a D-pad-only live-TV app for Samsung Tizen and Android TV, sharing one vanilla-TypeScript web codebase (mirroring the sibling `bero-movies` project). It authenticates as a **guest** against the Silkgo platform (`api-new.silkgo.ge`, grant `client_implicit`, verified) and consumes **silkgo's own live-TV backend** (`api-new.silkgo.ge/api/v1`) for channels, EPG, HLS stream URLs, and DVR/catch-up. **(UPDATE 2026-06-21: the originally-assumed Tvibo middleware at `api.tvibo.com` is abandoned/dead; the real, verified API is the silkgo backend — see [contracts/silkgo-tv.md](./contracts/silkgo-tv.md). The whole chain — token → channels → stream → HLS — is confirmed working from a normal machine; no geo-lock.)** The experience is **player-first**: the app boots into the resumed last channel and layers dismissible overlays (now/next info bar, vertical channel list, per-channel program timeline, transport/scrubber) over the live video. **Catch-up / time-shift is core** ("watch whatever you want"), driven by per-channel DVR data. See [ui-ux-plan.md](./ui-ux-plan.md) for the interaction design and [api-research.md](./api-research.md) for the integration evidence.

## Technical Context

**Language/Version**: TypeScript 5.3, compiled by `gulp-typescript` to browser JS (no framework, no bundler — vanilla DOM + string-template rendering, as in bero-movies).

**Primary Dependencies**: Build-time only — `gulp`, `gulp-typescript`, `gulp-live-server`, `gulp-inject-string`. Runtime: none (zero third-party runtime deps). Playback uses platform-native players: **Tizen AVPlay** (`webapis.avplay`) and **Android ExoPlayer via the WebView host** (or native `<video>` fallback), both fed HLS `.m3u8`.

**Storage**: Device-local key/value for the Viewer session (access token, refresh token, last-watched channel, language) — `localStorage` in the Tizen webview and Android WebView; no server-side storage. No PII.

**Testing**: Lightweight unit tests for pure logic that is easy to get wrong and hard to debug on-device — transformers (API→renderer models), the server-time-offset / now-next rollover math, and the DVR-window availability calc. On-device validation via the quickstart scenarios. (bero-movies ships no tests; we add targeted units only where correctness risk is high.)

**Target Platform**: Samsung Tizen TV (≥2.3, 1080p landscape, packaged `.wgt` web widget) and Android TV (leanback launcher, WebView wrapper loading the same web app). One shared `src/` build, two packaging targets — NEEDS CLARIFICATION resolved in research.md (R1: exact OS baselines).

**Project Type**: TV web application (single shared codebase, dual packaging).

**Performance Goals**: SC-001 channel list visible <4s, play <5s; SC-004 surf <3s; SC-008 catch-up start <5s / rewind shows position <3s; SC-009 return-to-live <3s. Smooth D-pad focus traversal across a **virtualized** ~142-channel grid on low-power TV SoCs (target 60fps focus moves, no input lag >150ms).

**Constraints**: D-pad-only (no pointer), landscape-locked, **Georgia-only network reachability** for `api.tvibo.com` and streams, HLS only, single concurrent stream, transparent token refresh, failure isolation per capability (FR-017).

**Scale/Scope**: ~142 live channels; per-channel EPG (DVR-start → end-of-tomorrow); 2 routes (`player`, `guide`) + ~7 overlay components; 2 API clients (Silkgo auth, Tvibo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is an **unratified template** (placeholder principles only), so there are no formal numbered gates to enforce. In their absence, this plan adopts the spec's own governing constraints as gates:

| Gate | Status | Notes |
|------|--------|-------|
| **Simplicity / YAGNI** — no framework, no bundler, vanilla TS | ✅ PASS | Mirrors bero-movies; zero runtime deps |
| **Mirror bero-movies conventions** (router, models+transformers, HTTP bridge, packaging) | ✅ PASS | Structure below reuses the proven layout |
| **D-pad-only, landscape, 10-foot UI** | ✅ PASS | Enforced in UI/UX plan + key service |
| **Failure isolation (FR-017)** | ✅ PASS | Per-capability stores; one failing area degrades, not crashes |
| **No new persistence/PII** | ✅ PASS | Local token cache only, no accounts in v1 |

No violations → Complexity Tracking left empty. Re-checked post-design (Phase 1): still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-bero-tv-live-tv/
├── plan.md              # This file
├── spec.md              # Feature spec (with Clarifications)
├── ui-ux-plan.md        # Interaction/UX plan
├── api-research.md      # Source-integration evidence (verified)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (Silkgo auth + Tvibo client contracts)
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root) — mirrors bero-movies

```text
src/
├── ts/
│   ├── api-clients/
│   │   ├── AbstractClient.ts      # HTTP bridge (Android native + XHR fallback)
│   │   ├── SilkgoAuthClient.ts    # guest mint (client_implicit) + refresh
│   │   └── TviboClient.ts         # channels, programs, streams, dvr
│   ├── models/
│   │   ├── api-models.ts          # raw Tvibo/Silkgo response shapes
│   │   ├── channel.ts, program.ts, stream.ts, session.ts   # renderer models
│   │   └── config.ts              # hosts, client ids, constants
│   ├── transformers/              # api-models → renderer models
│   ├── stores/                    # Observable: channels, epg, player, session
│   ├── components/                # info-bar, channel-list, program-timeline,
│   │                              # transport-bar, guide-grid, category-rail,
│   │                              # search-overlay, number-entry
│   ├── pages/                     # player.ts (home), guide.ts
│   ├── services/
│   │   ├── PlayerService.ts       # AVPlay / ExoPlayer / <video> abstraction
│   │   ├── KeyService.ts          # central D-pad/media key map
│   │   ├── TimeService.ts         # server-time offset, now/next rollover
│   │   └── tizen-service.ts       # Tizen bg service (built separately)
│   ├── lib/                       # router, observable, renderer, deepLink, i18n
│   ├── polyfills/
│   └── main.ts
├── css/                           # style.css (red theme tokens)
└── images/                        # Bero TV branding, icons (user-supplied)

tizen/        # config.xml (landscape, AVPlay, network privileges), webapp build target, icon
android/      # leanback manifest, WebView host, app icon/banner
gulpfile.js   # build/watch (TS→JS, css/images copy, tizen html inject)
tsconfig.json
```

**Structure Decision**: Single shared web codebase under `src/`, built by gulp into `dist/` (web/Android) and `tizen/webapp/` (Tizen widget), exactly as bero-movies. Two API clients extend `AbstractClient` so the Android-bridge/XHR transport and geo-locked-host logic are shared. Playback is isolated behind `PlayerService` so Tizen AVPlay and Android ExoPlayer differences (especially time-shift seek) stay out of UI code.

## Complexity Tracking

> No constitution violations — section intentionally empty.
