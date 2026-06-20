---

description: "Task list for Bero TV — Live TV for Tizen & Android TV"
---

# Tasks: Bero TV — Live TV for Tizen & Android TV

**Input**: Design documents from `/specs/001-bero-tv-live-tv/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, ui-ux-plan.md

**Tests**: Not TDD. Only the targeted unit tests the plan calls for (transformers, time-offset/rollover, DVR-window calc) are included, in Polish.

**Organization**: By user story (priority order). Note US1 and US3 are both **P1**; US1 is the MVP, US3 (catch-up/time-shift) is the core promise built directly on it.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: parallelizable (different files, no incomplete-task deps)
- All paths mirror the bero-movies layout (see plan.md → Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the dual-target vanilla-TS project.

- [x] T001 Create the `src/ts/{api-clients,models,transformers,stores,components,pages,services,lib,polyfills}`, `src/css`, `src/images` structure per plan.md
- [x] T002 Create `package.json`, `gulpfile.js`, `tsconfig.json` mirroring bero-movies (gulp build/watch: TS→dist/js, css/images copy, tizen webapp HTML inject)
- [x] T003 [P] Create `tizen/config.xml` (app id, landscape lock, 1080p, internet/network privileges, AVPlay, icon, app-control resume) and `tizen/` packaging assets
- [x] T004 [P] Create `android/` leanback WebView host (AndroidManifest with LEANBACK_LAUNCHER + landscape, `MainActivity` WebView loading the shared web app, `network_security_config`)
- [x] T005 [P] Create `src/css/style.css` with the red theme tokens + focus treatment from ui-ux-plan.md §9 (`--accent #E11D2A`, dark surfaces, overscan, focus ring)
- [x] T006 [P] Create `src/ts/lib/i18n.ts` + `ka` string table scaffold (no hard-coded UI text — FR-003)
- [x] T007 [P] Create `src/index.html` shell + `src/ts/main.ts` bootstrap (router setup, Tizen `backPressed` → router.goBack)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infra all stories depend on. **⚠ No user-story work begins until this phase is complete.**

- [x] T008 Create `src/ts/models/config.ts` (hosts: api-new.silkgo.ge, api.tvibo.com, thumbs01; client ids guest=7/user=11; constants)
- [x] T009 Implement `src/ts/api-clients/AbstractClient.ts` HTTP bridge (Android `window.Android.get/post` callbacks + XMLHttpRequest fallback; host selection)
- [x] T010 [P] Implement `src/ts/lib/observable.ts` (Observable store)
- [x] T011 [P] Implement `src/ts/lib/router.ts` (routes `player`, `guide`; goTo/goBack/replacePage)
- [x] T012 [P] Implement `src/ts/lib/renderer.ts` (string-template render + handler registration)
- [x] T013 [P] Implement `src/ts/services/KeyService.ts` (central D-pad/media key map per ui-ux-plan §7, context-aware)
- [x] T014 Create `src/ts/models/api-models.ts` (raw Silkgo token + Tvibo channel/program/stream/dvr shapes)
- [x] T015 Implement `src/ts/api-clients/SilkgoAuthClient.ts` — `mintGuestToken` (`client_implicit`, client_id 7) + `refresh` + error contract (depends T009, T014; see contracts/silkgo-auth.md)
- [x] T016 Implement `src/ts/stores/sessionStore.ts` + ViewerSession `localStorage` persistence (reuse-while-valid → proactive/reactive refresh → re-mint) (depends T015)
- [x] T017 Implement `src/ts/services/TimeService.ts` (`getServerTime` → offset; now = Date.now()+offset) (depends T009)
- [x] T018 Implement `src/ts/services/PlayerService.ts` abstraction skeleton (Tizen AVPlay + Android ExoPlayer/`<video>` seam; live play API)
- [x] T019 Implement `src/ts/pages/player.ts` shell (boot → resume `sessionStore.lastChannelId`) + `src/ts/pages/guide.ts` route stub
- [x] T020 **Gate 0 — RESOLVED 2026-06-21**: live TV is silkgo's own backend `api-new.silkgo.ge/api/v1` (NOT Tvibo, which is dead). Implemented `src/ts/api-clients/SilkgoTvClient.ts` and verified the full chain (guest token → `/channel?type=tv` → `/channel/chunk/{slug}` → HLS) end-to-end from a normal machine. No geo-lock. See contracts/silkgo-tv.md.

**Checkpoint**: Foundation ready — token handoff resolved; stories can begin.

---

## Phase 3: User Story 1 - Browse and watch a live channel (Priority: P1) 🎯 MVP

**Goal**: Cold-launch into a browsable, virtualized channel list and play a selected live channel full-screen via remote.

**Independent Test**: Launch cold; channel list populates (<4s) with name/logo/now-playing; D-pad navigate; OK plays live (<5s); Back returns to list with focus preserved.

- [x] T021 [P] [US1] Create `src/ts/models/channel.ts` (Channel + Category renderer models per data-model.md)
- [x] T022 [P] [US1] Create `src/ts/models/stream.ts` (Stream renderer model)
- [x] T023 [P] [US1] Create `src/ts/transformers/channelTransformer.ts` (api-models → Channel/Category, including now-playing title)
- [x] T024 [US1] Implement `TviboClient.getChannels()` + `getStreamUrl(channelId)` (live) in `src/ts/api-clients/TviboClient.ts` (depends T020, T023)
- [x] T025 [US1] Implement `src/ts/stores/channelsStore.ts` (channels + categories, loading/error) (depends T024)
- [x] T026 [US1] Implement `src/ts/components/channel-list.ts` — windowed/virtualized vertical list, lazy logos, now-playing title (depends T025; ui-ux-plan §5.2)
- [x] T027 [US1] Implement `src/ts/components/number-entry.ts` overlay — type digits → jump to channel (FR-008a) (depends T025)
- [x] T028 [US1] Wire `player.ts` channel select → `PlayerService` live playback full-screen (depends T018, T024)
- [x] T029 [US1] Implement Back (player→list, preserve focus, FR-007) + localized stream error states geo/drm/unplayable (FR-009) in player.ts
- [x] T030 [US1] Implement channel-change debounce so rapid zapping doesn't stack stream requests (FR-019)

**Checkpoint**: MVP — live browse + play fully functional and independently testable.

---

## Phase 4: User Story 3 - Rewind and watch past programs (catch-up / time-shift) (Priority: P1, core)

**Goal**: Rewind/scrub the live stream and play earlier programs from the per-channel timeline within the DVR window; one-step return to live.

**Independent Test**: On a DVR channel, Rewind shows a "behind live" position (<3s); open the timeline and play a past program from its start (<5s); Jump-to-Live returns to the edge (<3s); non-DVR target shows a clear "unavailable" message.

- [x] T031 [P] [US3] Create `src/ts/models/program.ts` (Program model + past/live/upcoming state derivation)
- [x] T032 [P] [US3] Implement `src/ts/transformers/programTransformer.ts` + DVR-window calc from `dvr-gaps`/`recordingDuration` → `Channel.dvrWindow`, `Program.catchupPlayable`
- [x] T033 [US3] Add timeshift stream resolution to `src/ts/api-clients/SilkgoTvClient.ts` — `getPrograms()`/`getDvrGaps()` already implemented; add `channel/chunk/{slug}` with a seek/position param for catch-up (confirm exact param vs live traffic) (depends T024)
- [x] T034 [US3] Implement `src/ts/stores/epgStore.ts` (programs per channel; local rollover via TimeService; ~5-min + on-change refetch) (depends T033, T017)
- [ ] T035 [US3] Extend `PlayerService` with time-shift seek (AVPlay seekTo/jump; Android ExoPlayer) + `playerStore` mode/positionSec/behindLiveSec (depends T018, T028)
- [ ] T036 [US3] Implement `src/ts/components/transport-bar.ts` (scrubber, restart/rewind/play-pause/forward/jump-to-live) (depends T035; ui-ux-plan §5.4)
- [x] T037 [US3] Implement `src/ts/components/program-timeline.ts` (per-channel past→live→next; OK on past DVR program → catch-up play) (depends T034, T035; ui-ux-plan §5.3)
- [x] T038 [US3] Catch-up availability gating + "unavailable" messaging; seamless timeshift→live on overrun (FR-012, SC-008/009)

**Checkpoint**: Core promise delivered — watch any in-window program at any time on both platforms.

---

## Phase 5: User Story 2 - See what's on now and next (Priority: P2)

**Goal**: now/next overlay while watching, and channel surfing without leaving the player.

**Independent Test**: While playing, open the info bar → now/next titles + times shown; surf Up/Down → stream switches and info updates (<3s); channel with no EPG shows a graceful placeholder.

- [x] T039 [US2] Implement `src/ts/components/info-bar.ts` (now/next, progress bar, LIVE / behind-live badge) (depends T034; ui-ux-plan §5.1)
- [x] T040 [US2] Implement in-player surfing (Up/Down channel ±1 with info-bar update, debounced) (depends T026, T039)
- [x] T041 [US2] "No program information" placeholder when a channel lacks EPG data

**Checkpoint**: US1 + US3 + US2 all independently functional.

---

## Phase 6: User Story 4 - Search and category filtering (Priority: P3)

**Goal**: Filter channels by category; search programs by keyword.

**Independent Test**: Select a category → list filters to it; type a keyword → matching programs with channel/time listed; OK plays (live or catch-up).

- [ ] T042 [P] [US4] Implement `src/ts/components/category-rail.ts` + category filter on `channelsStore` (FR-013) (depends T025)
- [ ] T043 [P] [US4] Implement `src/ts/components/search-overlay.ts` (on-screen D-pad keyboard + native IME when available) + `TviboClient.searchPrograms()` (FR-014) (depends T024)
- [ ] T044 [US4] Search/category result → play (live or catch-up) (depends T028, T038)

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Unit tests for transformers in `tests/unit/transformers.test.ts`
- [ ] T046 [P] Unit tests for TimeService offset/now-next rollover + DVR-window availability in `tests/unit/time-dvr.test.ts`
- [ ] T047 Network-loss + standby/resume handling across stores (retry affordances, re-establish stale stream) (FR-016, SC-005)
- [ ] T048 Verify failure isolation across capabilities (EPG/search/dead stream don't break browse/play) (FR-017, SC-007)
- [ ] T049 [P] Wire Bero TV branding/icons (Tizen `config.xml` icon, Android launcher/banner) from user-supplied art (FR-018)
- [ ] T050 Build both targets; run quickstart.md scenarios 1–13 on Tizen and Android TV (SC-003)

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **blocks all stories**. T020 (Gate 0) gates all Tvibo data work.
- **US1 (P3 phase)** → after Foundational. MVP.
- **US3 (P4 phase, P1 core)** → after Foundational; builds on US1's player (T028) and TviboClient (T024).
- **US2 (P5 phase, P2)** → after Foundational; reuses `epgStore` (T034 from US3) and `channel-list` (T026 from US1).
- **US4 (P6 phase, P3)** → after Foundational; reuses channelsStore + play paths.
- **Polish (P7)** → after desired stories complete.

### Within each story
- Models → transformers → client methods → store → components → page wiring.

### Parallel opportunities
- Setup: T003, T004, T005, T006, T007 in parallel.
- Foundational: T010, T011, T012, T013 in parallel (after T008/T009).
- US1: T021, T022, T023 in parallel; then T024→T025→T026/T027.
- US3: T031, T032 in parallel; then T033→T034, T035→T036/T037.
- US4: T042, T043 in parallel.
- Polish: T045, T046, T049 in parallel.

---

## Parallel Example: User Story 1
```bash
# Models/transformer for US1 together:
Task: "Create Channel/Category models in src/ts/models/channel.ts"
Task: "Create Stream model in src/ts/models/stream.ts"
Task: "Create channel transformer in src/ts/transformers/channelTransformer.ts"
```

---

## Implementation Strategy

### MVP first (US1 only)
1. Phase 1 Setup → 2. Phase 2 Foundational (incl. **Gate 0 token handoff on GE network**) → 3. Phase 3 US1 → **STOP & validate live browse+play on Tizen + Android TV** → demo.

### Incremental delivery
US1 (MVP, live) → **US3 (catch-up/time-shift — the core promise)** → US2 (now/next + surfing) → US4 (discovery). Each ships independently without breaking prior stories.

### Notes
- [P] = different files, no incomplete-task deps.
- All live-TV tasks require a Georgian network (geo-lock).
- Commit after each task or logical group; validate at each checkpoint.
