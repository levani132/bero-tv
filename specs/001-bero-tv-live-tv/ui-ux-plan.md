# Bero TV — UI/UX Plan

**Created**: 2026-06-21
**Status**: Draft for review
**Scope**: Interaction & experience plan (not visual mockups). Defines the navigation model, screen inventory, the player-centric overlay system, the time-shift/catch-up experience, states, remote key map, and the visual/branding token system. Feeds `/speckit-plan`.

> **Scope note**: This plan treats **catch-up / time-shift ("watch whatever you want")** as a **core** capability, not a P3 deferral. The product promise is "watch any channel, at any point in its recent timeline." `spec.md` must be updated to match (promote User Story 3 and make FR-012 a MUST) — flagged at the end of this doc.

---

## 1. Design principles

1. **10-foot UI** — designed to be read and operated from across a room. Large type, high contrast, generous spacing, one clear focus at all times. Nothing relies on precision pointing.
2. **Player-first** — the live stream is the home screen. The app boots straight into video (resumed last channel); everything else is an overlay *on top of* the playing stream, never a separate page that stops playback.
3. **D-pad only** — every action reachable with Up/Down/Left/Right/OK/Back plus optional media keys (Play/Pause, ◀◀/▶▶). No feature may require a pointer, keyboard, or color buttons.
4. **One thing at a time** — at most one overlay layer is open. Opening a deeper layer replaces, not stacks (predictable Back).
5. **Fast & forgiving** — channel changes feel instant (optimistic UI + debounce), errors never dead-end, and the stream keeps playing behind every menu.
6. **Georgian-first** — all copy in Georgian via an i18n string layer; no hard-coded UI text (English toggle deferred per FR-003).

---

## 2. Information architecture

The app is **one persistent player** with a stack of dismissible overlays — not a tree of pages.

```
                         ┌───────────────────────────────┐
   App launch ─────────► │   PLAYER  (always running)     │
   (resume last channel) │   full-screen live/timeshift   │
                         └───────────────┬───────────────┘
                                         │  (D-pad / OK wakes overlays)
        ┌──────────────────┬─────────────┼──────────────────┬─────────────────┐
        ▼                  ▼             ▼                  ▼                 ▼
  INFO BAR           CHANNEL LIST   PROGRAM TIMELINE    TRANSPORT BAR      FULL GUIDE
  (now/next,         (vertical      (this channel's     (rewind / pause /  (grid: channels ×
   auto-hide)         overlay,       schedule strip,     restart / jump-    time; catch-up
                      left side)     past→live→next)     to-live, scrubber) entry point)

   Secondary surfaces reachable from CHANNEL LIST / GUIDE header:
     • CATEGORY FILTER (chips/rail)      • SEARCH (programs by keyword)
```

There are only two **routes** in the router sense — `player` and `guide` (the full grid is heavy enough to be its own page). Everything else is an overlay component mounted over `player`. This mirrors bero-movies' `Router.registerRoute` + page `mount()` pattern (`player`, `guide`), keeping the architecture familiar.

---

## 3. Navigation & focus model

### 3.1 D-pad mapping (on the bare player, no overlay open)

| Key | Action |
|-----|--------|
| **OK** | Open the **Info bar** (now/next) — a light first touch |
| **Up / Down** | Channel **up / down** (zap to adjacent channel, debounced) — the classic TV behavior |
| **Left / Right** | Scrub the **timeline** back / forward (enters time-shift); shows the transport bar |
| **Left long-press / ◀◀** | Jump back in larger steps (e.g., −30s, then accelerates) |
| **▶▶** | Jump forward toward live; **▶▶ at live edge** is a no-op |
| **Back** | If timeshifted → snap to **live**; if already live → show "Press Back again to exit" |
| **Menu / OK-hold** | Open the **Channel list** overlay |
| **Play/Pause** | Pause = enter time-shift at current point; Play = resume |

### 3.2 Spatial focus rules
- **Exactly one focused element** at any time, always visibly highlighted (see §10 focus treatment).
- **Wrap-around**: vertical lists wrap top↔bottom; the full guide grid does **not** wrap (edges clamp) to avoid disorientation.
- **Focus memory**: each overlay remembers its last focused item; reopening restores it. Returning from the player to the channel list lands on the channel you were watching (FR-007).
- **No focus traps**: every overlay has an obvious Back exit; the stream is always visible/audible behind it.

### 3.3 Back-button contract (predictable, layered)
```
Full guide / Search / Category   ──Back──►  Channel list
Channel list / Transport / Info  ──Back──►  bare Player (overlay closes)
Timeshifted Player               ──Back──►  snap to Live
Live Player                      ──Back──►  "Press Back again to exit" → exit app
```

---

## 4. The player-centric model

- **Boot**: splash → restore persisted guest token (FR-002a) → resume **last-watched channel** at the **live edge**, autoplay. First-time users (no last channel) land on the first channel of the default category with the Channel list pre-opened.
- The stream **never stops** for navigation. Overlays are translucent scrims over live video.
- **Standby/resume**: on wake, if the stream URL is stale, transparently re-establish it at the live edge; restore the last overlay state (per spec edge cases).
- **Auto-hide**: the Info bar and Transport bar fade after ~5s of no input; the Channel list and Guide stay until dismissed.

---

## 5. Overlay system (the heart of the app)

### 5.1 Info bar (now/next) — lightest layer
Bottom-anchored strip. Triggered by OK or any channel change. Shows: channel number + logo + name, **NOW** program (title, progress bar, start–end), **NEXT** program (title, start). A red **● LIVE** badge when at the live edge; a **⏱ −12:30 behind live** badge when timeshifted. Auto-hides after ~5s.

```
┌──────────────────────────────────────────────── overscan-safe ──┐
│                                                                  │
│   (live video continues full-screen behind)                     │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 12  [logo]  Rustavi 2        ● LIVE                        │   │
│ │ NOW  20:00–21:00  News Hour   ▓▓▓▓▓▓▓░░░░░░  (62%)         │   │
│ │ NEXT 21:00        Movie: ...                               │   │
│ └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Channel list — vertical overlay (primary browse surface, per your spec)
Left-anchored vertical list (~38% width) over the live stream. Each row: number, logo, name, and the channel's **NOW** program title. Focused row is highlighted and enlarged; **Right** or **OK** confirms the channel (stream switches, list stays briefly then auto-closes). Header hosts **Category filter** and **Search** entry. Virtualized/windowed rendering (≈142 channels — see spec clarification) so D-pad scrolling stays smooth.

```
┌──────────────────────────┐
│  ⌕ Search    ▸ Category   │  ← header (Up from first row focuses these)
├──────────────────────────┤
│ 11 [l] Imedi   · News Hour│
│▶12 [l] Rustavi2· News Hour│ ◀ focused (enlarged + red ring)
│ 13 [l] GPB     · Movie    │
│ 14 [l] Maestro · Talk Show│
│   …(windowed)            …│
└──────────────────────────┘
   live video continues to the right →
```

### 5.3 Program timeline ("program switcher inside the channel") — the catch-up surface
This is what delivers **"watch whatever you want."** A horizontal strip of *this channel's* programs along a time axis — past programs to the left, the live edge marked, upcoming (un-selectable) to the right. Left/Right moves between programs; **OK on a past program** starts catch-up playback of that program from its beginning (if the channel's `dvr-gaps`/`recordingDuration` allow). Programs outside the DVR window are dimmed and show "not available."

```
        ◀ earlier today                    live ●           later ▶
 ┌────────┬────────────┬───────────────┬──────────┬─────────────┐
 │ 18:00  │   19:00     │    20:00 NOW  │  21:00   │   22:00     │
 │ Cooking│  Documentary│  ▶ News Hour  │  Movie   │  Late Show  │
 │  (DVR) │   (DVR)     │   (live ●)    │ (upcoming│  (upcoming) │
 └────────┴────────────┴───────────────┴──────────┴─────────────┘
   OK on a DVR block → play that program from its start
```

### 5.4 Transport bar (time-shift controls) — appears whenever not at live edge
Bottom scrubber with a draggable position relative to the DVR window. Controls (D-pad Left/Right move the scrub head; OK toggles play/pause): **⏮ Restart program · ◀◀ Rewind · ⏯ Play/Pause · ▶▶ Forward · ⏭ Jump to Live**. Shows current position, program boundaries as ticks, and "behind live" delta.

```
┌──────────────────────────────────────────────────────────────┐
│  News Hour            −12:30 behind live                       │
│  ⏮   ◀◀    ⏯    ▶▶   ⏭LIVE                                     │
│  ├────────●───────────────────────┤  (●=now, ┤=live edge)     │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 Full guide (grid EPG) — secondary, its own route
Channels down the Y axis, time across the X axis, "now" line marked. Left/Right scroll time, Up/Down change channel. OK on a past+DVR cell → catch-up; on a live cell → switch & watch; on a future cell → "reminder" (future enhancement, not v1). Heavy surface, lazy-loaded per visible time window.

### 5.6 Category filter & Search
- **Category**: a horizontal chip rail in the Channel list / Guide header; selecting filters the list (FR-013).
- **Search**: D-pad-driven on-screen keyboard (or remote text), queries programs by keyword via `programs/search` (FR-014). Results show program + channel + time; OK plays (catch-up if past, live if now).

---

## 6. Screen/overlay inventory & states

| Surface | Type | Trigger | Key states |
|---------|------|---------|-----------|
| Splash / boot | full screen | launch | logo + spinner; "connecting…"; retry on failure |
| Player | route (home) | always | live · timeshifted · buffering · error |
| Info bar | overlay | OK / zap | normal · no-EPG placeholder |
| Channel list | overlay | Menu / OK-hold | loading skeleton · loaded · empty · filtered |
| Program timeline | overlay | Left/Right on player | DVR-available · DVR-unavailable (dimmed) |
| Transport bar | overlay | scrub / pause | live-edge (hidden) · timeshifted |
| Full guide | route | from list header | loading window · loaded · no-data row |
| Category filter | inline rail | list/guide header | — |
| Search | overlay | list/guide header | empty · typing · results · no-results |

**Global states** (per spec edge cases): no/slow network at launch → retry affordance, never blank; guest token failure → clear message + retry; stream geo/DRM/unplayable → localized error, stay navigable, easy hop to another channel; token expiry mid-session → transparent refresh; standby resume → restore + re-establish stream; rapid zapping → debounce stream switches (FR-019).

---

## 7. Remote key map (full)

| Context | Up/Down | Left/Right | OK | Back | Play/Pause | ◀◀ / ▶▶ |
|---------|---------|-----------|----|----|------------|---------|
| Player (live) | Channel ±1 | Scrub → timeshift | Info bar | exit (double) | Pause→timeshift | Rewind/Fwd |
| Player (timeshift) | Channel ±1 | Scrub | Transport | →Live | Play/Pause | Rewind/Fwd |
| Info bar | Channel ±1 | — | open Channel list | close | — | — |
| Channel list | Move focus | Right=confirm / header | confirm channel | close | — | page scroll |
| Program timeline | exit to channel list | prev/next program | play program | close | — | — |
| Transport bar | — | move scrub head | play/pause | →Live | toggle | step |
| Full guide | channel ±1 row | scroll time | play cell | →list | — | jump ±3h |
| Search | results / keyboard | keyboard nav | select/type | →list | — | — |

---

## 8. Time-shift / catch-up UX (the core promise)

1. **Enter** time-shift implicitly: pressing Left, Pause, or selecting a past program. No mode switch the user has to learn.
2. **Visual truth**: whenever not at the live edge, a persistent "⏱ behind live" badge + the transport scrubber are visible so the user always knows they're in the past.
3. **Boundaries are honest**: the scrubber's left limit = the channel's DVR window (`dvr-gaps` / `recordingDuration`). Beyond it: dimmed + "not available," never a silent failure (FR-012, spec US3 scenario 3).
4. **Return to live** is always one press (Back or ⏭). Catch-up that overruns into the live edge seamlessly becomes live.
5. **Per-channel capability**: channels without catch-up show the timeline as live-only (no past blocks); the UI degrades gracefully rather than hiding the feature inconsistently.

---

## 9. Visual system & theme tokens

Dark, cinematic, TV-safe — red accent replacing bero-movies' teal. Concrete tokens (tunable):

| Token | Value | Use |
|-------|-------|-----|
| `--bg-base` | `#0E0E10` | app background (near-black, avoids OLED smear) |
| `--surface` | `#18181B` | overlay panels |
| `--surface-raised` | `#232328` | focused cards, headers |
| `--accent` | `#E11D2A` | **primary red** — focus, LIVE badge, active state |
| `--accent-focus` | `#FF3B45` | focus glow / hover |
| `--accent-pressed` | `#B5141F` | pressed/confirm |
| `--text-primary` | `#F2F2F3` | titles |
| `--text-secondary` | `#A1A1AA` | meta, times |
| `--ok-online` | `#2EBD85` | connectivity OK |
| `--scrim` | `rgba(0,0,0,.55)` | behind overlays over video |

- **Overscan**: 5% safe-area padding on all edges (TV cutoff).
- **Typography**: a sans family **with full Georgian glyph coverage** (e.g., FiraGO or Noto Sans Georgian) — non-negotiable since default is Georgian. Sizes scaled for 10-foot reading (body ≥ 28px @1080p).
- **Focus treatment** (single most important visual): focused element gets `transform: scale(1.06)`, a **3px `--accent` ring**, and an outer glow `0 0 0 6px rgba(225,29,42,.35)`. Motion ≤ 150ms ease-out. This is the user's "cursor."
- **LIVE badge**: red dot with a slow pulse; **behind-live** badge uses `--text-secondary`.

---

## 10. Branding

- **Wordmark**: **BERO** in near-black/white + **TV** in `--accent` red — directly parallels the Bero Movies "BERO MOVIES" lockup, swapping the teal sublabel for red and "MOVIES"→"TV". Assets created at `assets/branding/`:
  - `bero-tv-logo.svg` — transparent wordmark (light contexts / splash on dark).
  - `bero-tv-icon.svg` — square launcher tile (dark tile + wordmark) for Tizen/Android leanback.
- Replaces the source portal's branding entirely (FR-018). Tizen `config.xml` icon + Android `app_icon` will point at rasterized exports of these (export step in `/speckit-plan`).

---

## 11. Resolved design decisions (best-practice defaults, self-answered)

These are the clarification questions for this area, answered from common live-TV / TV-provider patterns so planning isn't blocked:

| # | Question | Decision & rationale |
|---|----------|---------------------|
| D1 | Home screen on launch? | **Resume last channel, playing.** Player-first is the norm for TV-provider apps; it gets the user to content in zero presses. |
| D2 | Primary browse surface? | **Vertical channel list overlay** over live video (your call) — fastest zap-and-preview, keeps the stream alive. |
| D3 | How is catch-up entered? | **Implicitly** via Left/Pause/selecting a past program — no explicit "DVR mode." Matches Sky Q / modern providers. |
| D4 | Live vs timeshift indication? | **Persistent badge + scrubber** whenever off the live edge; one-press return to live. Prevents "why is this not live?" confusion. |
| D5 | Full grid guide in v1? | **Yes, but secondary** — the vertical list + per-channel timeline cover 90% of use; the grid is the power-user surface. |
| D6 | Zapping behavior? | **Up/Down = channel ±1** with debounce + optimistic info bar; **number entry** also supported. The universal TV mental model. |
| D7 | Future programs? | **Visible but not playable** in v1 (reminders deferred). Honest, no dead ends. |
| D8 | Accent color? | **Red `#E11D2A`** per your direction; tunable. High legibility on dark, distinct from the teal Bero Movies brand. |

---

## 12. Architecture fit (mirrors bero-movies)

- **Routes**: `player` (home), `guide`. Overlays are components mounted over `player` (matches `Router` + `mount()` pattern).
- **Components**: `channel-list-item`, `info-bar`, `program-timeline`, `transport-bar`, `guide-grid`, `category-rail`, `search-overlay`.
- **Stores** (observable): `channelsStore`, `epgStore`, `playerStore` (current channel, position, live/timeshift), `sessionStore` (token, last channel, language).
- **Services**: `tizen-service` (AVPlay) / Android (ExoPlayer/WebView) behind a `PlayerService` abstraction; `KeyService` for the central remote key map.
- **Transformers**: Tvibo API models → renderer models (channel, program, stream) — same pattern as `apiMovieToMovieTransformer`.

---

## 13. Follow-ups (not in this doc)

1. **Spec scope bump** — promote User Story 3 (catch-up/time-shift) to core and make **FR-012 a MUST**; adjust Success Criteria to include a catch-up start time. (Recommended next, before re-running clarify.)
2. **Open UI questions for the next clarify session**: number-entry channel input on/off; search input method (on-screen keyboard vs. voice); guide time-window depth (today only vs ±N days); reminders/favorites (likely still deferred).
3. **Asset export** — rasterize SVGs to the icon sizes Tizen `config.xml` and Android leanback require (planning task).
```
