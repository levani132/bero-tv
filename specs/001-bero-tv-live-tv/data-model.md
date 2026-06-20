# Phase 1 Data Model: Bero TV

**Date**: 2026-06-21 · Renderer-model entities (the shapes the UI consumes), derived from the spec's Key Entities and produced by transformers from raw Tvibo/Silkgo API models. Raw API shapes live in `models/api-models.ts`; these are the normalized renderer models.

---

## Channel
The live TV channel shown in lists/grids and played. Source: `api-new.silkgo.ge/api/v1/channel?type=tv` (JSON:API; verified).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | channel UUID (identity; used as EPG `channelId`) |
| `slug` | string | stream/DVR key (e.g. `silk_sport4`); used for `channel/chunk/{slug}` and `dvr-gaps` |
| `number` | number | display/zap number; unique; used by number-entry (FR-008a) |
| `name` | string | display name (Georgian) |
| `logoUrl` | string | preview image (`thumbs01.myvideo.ge/previews/tv/…`) |
| `categoryIds` | string[] | for category filtering (FR-013) |
| `hasCatchup` | boolean | derived from presence of DVR data |
| `dvrWindow` | `{ startsAt: epoch, durationSec: number } \| null` | from `dvr-gaps`/`recordingDuration`; bounds catch-up (FR-012) |
| `nowProgramId` | string \| null | convenience pointer into EPG |

**Rules**: `number` unique across catalog (~142). `hasCatchup = dvrWindow != null`. Sort order = source order unless category-filtered.

## Program (EPG entry)
A scheduled broadcast on a channel.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | program id |
| `channelId` | string | FK → Channel |
| `title` | string | |
| `description` | string \| null | |
| `startsAt` / `endsAt` | epoch (s) | server-time aligned |
| `thumbUrl` | string \| null | when `thumbs=enabled` |
| `state` | `'past' \| 'live' \| 'upcoming'` | derived from now = `Date.now()+offset` |
| `catchupPlayable` | boolean | `state==='past' && within channel.dvrWindow` |

**State transitions**: `upcoming → live → past`, rolled over locally at `endsAt` (R5). `catchupPlayable` recomputed when `dvrWindow` or now changes.

## Stream
A playable source for a channel (live) or a program/position (catch-up).

| Field | Type | Notes |
|-------|------|-------|
| `channelId` | string | |
| `url` | string | HLS `.m3u8` from `player/streamurl/…` |
| `mode` | `'live' \| 'timeshift'` | |
| `positionSec` | number \| null | offset behind live edge when timeshift |
| `programId` | string \| null | set when started from a specific program |

**Rules**: quality is ABR (no manual variant — clarified). A timeshift stream that overruns the live edge transitions `mode → 'live'` (FR-012, SC-009).

## Category
Grouping for discovery.

| Field | Type |
|-------|------|
| `id` | string |
| `name` | string |
| `channelCount` | number |

## ViewerSession
Persisted access + resume state (localStorage; no PII).

| Field | Type | Notes |
|-------|------|-------|
| `accessToken` | string | guest bearer (JWT) |
| `refreshToken` | string \| null | |
| `expiresAt` | epoch (s) | for proactive refresh |
| `isGuest` | boolean | true in v1 |
| `lastChannelId` | string \| null | resume target on launch |
| `language` | `'ka'` | Georgian only in v1; i18n-ready |

**Lifecycle**: `mint (client_implicit) → persist → reuse-while-valid → refresh (refresh_token, client_id 11) → re-mint if refresh fails`. (R6)

## PlayerState (transient, not persisted)
Drives player UI; held in `playerStore`.

| Field | Type | Notes |
|-------|------|-------|
| `currentChannelId` | string | |
| `mode` | `'live' \| 'timeshift'` | |
| `positionSec` / `behindLiveSec` | number | scrubber + "behind live" badge |
| `status` | `'loading' \| 'playing' \| 'buffering' \| 'error'` | |
| `error` | `{ kind: 'geo'\|'drm'\|'unplayable'\|'network', message: string } \| null` | localized (FR-009) |

---

## Relationships

```
Category 1───* Channel 1───* Program
Channel 1───1 dvrWindow (optional)
Channel 1───* Stream (live + timeshift variants, on demand)
ViewerSession 1───1 lastChannel (Channel)
PlayerState 1───1 currentChannel (Channel)
```

## Store ownership (Observable, per-capability for FR-017)
- `channelsStore` → Channel[] + Category[] (+ loading/error)
- `epgStore` → Program[] keyed by channelId (+ per-channel loading/error)
- `playerStore` → PlayerState
- `sessionStore` → ViewerSession
