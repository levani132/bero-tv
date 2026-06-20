# Feature Specification: Bero TV — Live TV for Tizen & Android TV

**Feature Branch**: `001-bero-tv-live-tv`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "we want to create a new project that will look like this (Will be a web project for tizen and android tv) and will work as a live tv the source for it will be https://silkgo.ge/tv, so the model will have to explore the portal and all the apis it uses and write specifications for how our new project Bero TV will connect to that api. We'll create a new logo and everything for it, but first of all let's start by designing the specifications in a new project that will be located in the ../bero-tv folder"

> **Source research**: The companion document [api-research.md](./api-research.md) records how the silkgo.ge/tv portal and its APIs were explored, and is the evidence base for the integration assumptions below. The portal delegates live TV to the **Tvibo IPTV middleware** behind a guest/OAuth token issued by the Silkgo platform.

## Clarifications

### Session 2026-06-21

- Q: How many live channels does the catalog hold, and how should the channel grid render? → A: ~142 channels (Option B); channel grid MUST use virtualized/windowed rendering.
- Q: Does the guest credential persist across app restarts, or is it minted fresh each launch? → A: Persist token + refresh token in device storage; reuse while valid, refresh transparently, mint only when missing/expired.
- Q: Does v1 ship a user-facing Georgian⇄English toggle, or Georgian-only? → A: v1 is Georgian-only; build an i18n-ready string layer (no hard-coded strings) but defer the user-facing English toggle to a later version.
- Q: Manual stream-quality picker or ABR only? → A: ABR only for v1; the player auto-selects quality from the HLS manifest, no manual quality UI.
- Q: How does now/next stay current while the viewer stays on one channel? → A: Roll over client-side from the cached schedule aligned to the server-time offset; refetch the EPG periodically (~5 min) and on channel change.
- Q: Can the viewer type a channel number to jump directly? → A: Yes — support numeric direct-entry via a brief on-screen overlay, in addition to Up/Down zapping.
- Q: How does the viewer enter search keywords? → A: On-screen D-pad keyboard, using the platform's native remote text input (IME) when available.
- Q: How far does the guide/EPG span in time? → A: From each channel's DVR start (past) through end of tomorrow (future), lazy-loaded per visible window.
- Q: Is catch-up depth an app target or source-driven? → A: Fully source-driven per channel — display whatever `dvr-gaps`/`recordingDuration` allow; mark the rest unavailable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and watch a live channel (Priority: P1)

A viewer opens Bero TV on their Samsung (Tizen) or Android TV. The app shows a grid/list of available live TV channels with logos and the program currently airing. Using the remote's D-pad, the viewer moves between channels, presses OK on one, and the live stream begins playing full-screen within a few seconds.

**Why this priority**: This is the core promise of a live-TV app and the minimum viable product. Without channel browsing and playback, nothing else matters. It is also deliverable using only a guest token (no account system required), making it the fastest path to a working product.

**Independent Test**: Launch the app cold on a TV (or TV emulator), confirm the channel list populates, navigate with the remote, select a channel, and verify the live video plays and audio is in sync. Delivers a fully usable "live TV" experience on its own.

**Acceptance Scenarios**:

1. **Given** the app has launched and obtained access as a guest, **When** the channel list finishes loading, **Then** each channel shows its name, logo, and the title of the program currently airing.
2. **Given** the channel list is visible, **When** the viewer presses Right/Left/Up/Down on the remote, **Then** focus moves predictably between channels and the focused channel is visually highlighted.
3. **Given** a channel is focused, **When** the viewer presses OK, **Then** the live stream starts playing full-screen within 5 seconds (on a typical broadband connection).
4. **Given** a channel is playing full-screen, **When** the viewer presses Back, **Then** playback stops and the channel list reappears with focus on the channel they were watching.
5. **Given** a stream fails to load, **When** the error occurs, **Then** the viewer sees a clear, localized message and the app remains navigable (does not crash or freeze).

---

### User Story 2 - See what's on now and next (channel surfing with EPG) (Priority: P2)

While watching a channel, the viewer brings up a channel overlay/bar that shows the current and upcoming programs for that channel (now/next), and can surf to adjacent channels and preview their current program without leaving the player.

**Why this priority**: "What's on" turns a raw stream list into an actual TV experience and is the most-used feature of every live-TV product. It builds directly on Story 1 and uses the same data source.

**Independent Test**: While a channel plays, open the overlay, confirm now/next program titles and times appear for the current channel, surf up/down to another channel, and confirm its now/next info appears and the stream switches.

**Acceptance Scenarios**:

1. **Given** a channel is playing, **When** the viewer opens the channel overlay, **Then** the now-playing program title, start/end time, and the next program are shown.
2. **Given** the overlay is open, **When** the viewer surfs to the next/previous channel, **Then** the stream switches and the overlay updates to that channel's now/next within 3 seconds.
3. **Given** a channel has no program data available, **When** the overlay opens, **Then** a graceful placeholder ("No program information") is shown instead of a blank or error.

---

### User Story 3 - Rewind and watch past programs (catch-up / time-shift) (Priority: P1)

While watching a channel, the viewer rewinds the live stream or picks an earlier program from that channel's timeline and plays it from the start, then returns to the live edge in one step. Where a channel allows it (per-channel DVR window), any program within that window can be played at any time.

**Why this priority**: This is the core product promise — "watch whatever you want, whenever you want," not just whatever is airing now. Live-only is explicitly insufficient. The portal exposes the needed data (program timelines, DVR gaps, recording duration, time-shift streams), so it is feasible for the MVP. The full grid-style guide (FR-011) remains a secondary surface; the primary catch-up entry points are in-player rewind and the per-channel program timeline.

**Independent Test**: While a channel plays, press Rewind (or scrub left) and confirm the stream moves into the past with a clear "behind live" indicator; open the channel's program timeline, select an earlier program on a DVR-enabled channel, and verify it plays from the start; press Back/Jump-to-Live and confirm it returns to the live edge.

**Acceptance Scenarios**:

1. **Given** a channel is playing live, **When** the viewer rewinds or scrubs backward within the channel's DVR window, **Then** playback moves to the past, a "behind live" indicator is shown, and a single action returns to the live edge.
2. **Given** the channel's program timeline (or full guide) is open, **When** the viewer selects an earlier program on a catch-up-enabled channel and presses OK, **Then** that program plays from its start.
3. **Given** a past program (or rewind target) on a channel that does not support catch-up, or beyond the DVR window, is selected, **When** the viewer presses OK, **Then** the app clearly indicates catch-up is unavailable rather than failing silently.
4. **Given** the viewer is watching a timeshifted program, **When** playback reaches the live edge or the viewer chooses Jump-to-Live, **Then** playback seamlessly continues as live.

---

### User Story 4 - Search and category filtering (Priority: P3)

The viewer filters channels by category (e.g., news, sport, entertainment) and searches programs by keyword to find something to watch quickly.

**Why this priority**: Improves discovery as the channel count grows; useful but not required for an MVP.

**Acceptance Scenarios**:

1. **Given** channels span multiple categories, **When** the viewer selects a category, **Then** only channels in that category are shown.
2. **Given** the viewer enters a keyword via the on-screen/remote input, **When** the search runs, **Then** matching programs (and their channels/times) are listed.

---

### Edge Cases

- **No / slow network at launch**: app shows a retry affordance and does not present an empty, frozen screen.
- **Guest access cannot be obtained**: app surfaces a clear message and a retry; it does not silently show an empty list.
- **Token expires mid-session**: access is transparently refreshed and playback continues without forcing the viewer to restart.
- **A stream URL is geo-blocked, DRM-protected, or returns an unplayable format**: the viewer gets a specific, localized error and can move to another channel.
- **Remote sends rapid repeated key presses** (channel surfing): the app debounces stream switches so it does not stack requests or stutter.
- **App resumes from background / TV wakes from standby**: the last state is restored and any stale stream is re-established.
- **Source portal changes its API or token scheme**: failures are isolated to the affected capability with a clear message; the app does not hard-crash.
- **Audio/video desync or buffering stall**: player recovers (re-buffer) or surfaces an error after a bounded wait.

## Requirements *(mandatory)*

### Functional Requirements

**Access & session**
- **FR-001**: System MUST obtain access to the live-TV catalog automatically on launch without requiring the viewer to create an account or log in (guest access).
- **FR-002**: System MUST keep access valid for the duration of a viewing session, refreshing credentials transparently before they expire.
- **FR-002a**: System MUST persist the guest credential (access + refresh token) in device storage and reuse it across app restarts while valid, minting a new token only when none is stored or the stored one has expired/failed refresh.
- **FR-003**: System MUST request content in Georgian by default. v1 ships Georgian-only; all UI strings MUST go through an i18n-ready string layer (no hard-coded UI text) so an English option can be added later without rework. The user-facing language toggle is out of scope for v1.

**Channels & playback**
- **FR-004**: System MUST retrieve and display the list of available live channels, each with a name, logo, and currently-airing program title where available.
- **FR-005**: Users MUST be able to navigate the channel list and all interactive surfaces entirely with a TV remote D-pad (Up/Down/Left/Right/OK/Back); no pointer or touch input may be required.
- **FR-006**: System MUST play a selected channel's live stream full-screen, including video and synchronized audio. Quality selection relies on HLS adaptive bitrate (ABR); v1 does not expose a manual quality picker.
- **FR-007**: System MUST allow returning from playback to the channel list with the Back key, preserving the previously focused channel.
- **FR-008**: System MUST allow surfing to the next/previous channel from within the player.
- **FR-008a**: System MUST allow direct channel selection by entering a channel number on the remote's numeric keypad, shown via a transient on-screen number-entry overlay, in addition to Up/Down zapping.
- **FR-009**: System MUST present clear, localized error messaging for unplayable or unavailable streams and remain navigable after an error.

**Program information (EPG)**
- **FR-010**: System MUST display now/next program information for a channel (title and times) where the source provides it. While the viewer remains on a channel, the now/next rollover MUST be computed client-side from the cached schedule aligned to the source server-time offset; the EPG MUST be refetched periodically (~5 min) and on channel change.
- **FR-011**: System SHOULD provide a full grid-style program guide as a secondary discovery surface (the in-player timeline is the primary catch-up entry point). The guide MUST span, per channel, from the channel's DVR start (past) through the end of the following day (future), loading data lazily per visible time window.
- **FR-012**: System MUST allow playback of previously-aired programs and in-player rewind (catch-up / time-shift) within each channel's DVR window where the source indicates this is available, MUST clearly indicate the position relative to live, MUST allow one-step return to the live edge, and MUST clearly indicate when catch-up is unavailable rather than failing silently. The catch-up depth MUST be driven entirely by the source's per-channel DVR data (`dvr-gaps` / `recordingDuration`) — the app sets no fixed target or cap; positions outside the source-provided window are marked unavailable.

**Discovery**
- **FR-013**: System SHOULD allow filtering channels by category.
- **FR-014**: System SHOULD allow searching programs by keyword, with text entered via an on-screen D-pad keyboard, using the platform's native remote text input (IME) when one is available.

**Platform & resilience**
- **FR-015**: System MUST run as a web application packaged for both Samsung Tizen TV and Android TV, sharing one codebase and UI, consistent with the existing bero-movies project structure.
- **FR-016**: System MUST handle network loss, slow networks, and resume-from-standby gracefully with retry affordances rather than blank or frozen screens.
- **FR-017**: System MUST isolate failures of any single source capability (channels, guide, stream, search) so one failing area does not break the whole app.
- **FR-018**: System MUST present its own "Bero TV" branding (logo, name, theming) distinct from the source portal.
- **FR-019**: System MUST debounce rapid channel changes so that fast remote input does not stack stream requests or destabilize playback.

**Source integration (informative — see api-research.md)**
- **FR-020**: System MUST source live channels, program guide data, stream URLs, and catch-up/DVR data from the same upstream services the silkgo.ge/tv portal uses, authenticating with a guest bearer token. **VERIFIED 2026-06-21**: this is silkgo's own backend `api-new.silkgo.ge/api/v1` (not the Tvibo middleware, which is abandoned). Endpoints and shapes are in [contracts/silkgo-tv.md](./contracts/silkgo-tv.md); the full chain (token → channels → stream → HLS) is confirmed working from a normal machine.

### Key Entities *(include if data involves data)*

- **Channel**: A live TV channel — identity, display name, logo/preview image, category, and whether catch-up/DVR is available and for how far back. The catalog is ~142 channels; the channel grid MUST use virtualized/windowed rendering so D-pad navigation stays responsive on TV hardware.
- **Program (EPG entry)**: A scheduled broadcast on a channel — title, description, start/end time, optional thumbnail, and whether it is currently live, upcoming, or past.
- **Stream**: A playable source for a channel or program — a playback URL (HLS) plus any quality/variant and time-shift positioning. Quality is selected automatically via HLS ABR; no manual variant selection in v1.
- **Category**: A grouping of channels for filtering/discovery.
- **Viewer session**: The current access credential (guest or, later, logged-in), selected language, and last-watched channel for resume. The credential (access + refresh token) is persisted in device storage and reused across restarts while valid.
- **Brand/Theme assets**: Bero TV logo, app name, icons, and color theme used across both platforms.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a cold launch on a typical broadband connection, the channel list is visible within 4 seconds and a selected channel begins playing within 5 seconds of pressing OK.
- **SC-002**: A first-time viewer can find and start watching a channel using only the remote, with no instructions, in under 30 seconds.
- **SC-003**: The app runs and is fully operable via remote on both a Samsung Tizen TV (or emulator) and an Android TV (or emulator) from the same build pipeline.
- **SC-004**: Channel surfing (next/previous) switches the live stream within 3 seconds and never leaves the viewer on a frozen or blank screen.
- **SC-005**: When the network drops and returns, the app recovers to a working state (channel list or resumed playback) without requiring the viewer to force-quit.
- **SC-006**: For at least 95% of channels that publish program data, correct now/next information is shown.
- **SC-007**: No single source-capability failure (guide, search, a dead stream) prevents the viewer from browsing and playing other channels.
- **SC-008**: On a DVR-enabled channel, a previously-aired program selected from the timeline/guide begins playing from its start within 5 seconds, and rewinding from live shows the timeshifted position within 3 seconds.
- **SC-009**: From any timeshifted position, a single action returns the viewer to the live edge within 3 seconds.

## Assumptions

- **Source & legality**: Bero TV is a **proof-of-concept / demo** that consumes the same upstream live-TV services as silkgo.ge/tv to validate technical feasibility. It is not a redistribution product; any future public distribution would require separate authorization/licensing, which is a business/legal gate outside this spec.
- **Guest access is sufficient for MVP**: The platform issues a guest token (grant `client_implicit`, guest client id `7`) enabling channel browsing and playback without a user account. **Verified live 2026-06-21** — the mint returns a valid 24h bearer JWT. (Note: the guest grant is `client_implicit`, *not* `silk_implicit`, which is the user OTP-login path — see api-research.md §3.1.) Account login, favorites, and personalization are out of scope for v1.
- **Georgia-only operation**: The live-TV middleware (`api.tvibo.com`) and its streams are geo/IP-restricted to Georgia (verified 2026-06-21: unreachable from 58/59 global vantage points). Bero TV is developed, tested, and operated **entirely within Georgia**, so this is an accepted operating constraint, not a blocker — but all live-traffic validation (Tvibo endpoints, token handoff, stream playback) MUST be performed on a Georgian network.
- **Streams are HLS**: Live and catch-up streams are delivered as HLS (`.m3u8`), playable via the platform-native players (Tizen AVPlay/native video; Android TV ExoPlayer or WebView video), as in bero-movies.
- **Architecture mirrors bero-movies**: Vanilla TypeScript + custom router, the API-models/renderer-models + transformers pattern, an HTTP bridge abstraction (XMLHttpRequest on Tizen/web, native bridge on Android), Tizen `config.xml` + Android leanback manifest, landscape-locked, D-pad-only.
- **Default language is Georgian**. v1 is Georgian-only behind an i18n-ready string layer; a user-facing English toggle is deferred to a later version (see FR-003).
- **Token-exchange detail is unconfirmed**: Whether the live-TV middleware accepts the platform token directly or requires a brokered exchange is the primary integration risk and will be resolved during `/speckit-plan` against live traffic — which, per the Georgia-only constraint above, must be done from a Georgian network (the middleware is unreachable elsewhere).
- **Project location**: This is a standalone project at `/Users/levanpersonal/Projects/bero-tv`. It mirrors the sibling `bero-movies` project for build/packaging conventions.
- **Scope boundaries for v1**: Live channel browsing + playback + now/next EPG + **catch-up/time-shift (rewind and watch past programs within each channel's DVR window)** — catch-up is core to the product promise (User Story 3, P1). The full grid-style guide is a secondary surface (FR-011). Category filtering, search, accounts, and recommendations remain prioritized lower (P3+) and may move to later versions.
