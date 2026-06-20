# Contract: SilkgoTvClient (live TV)

Live TV is served by silkgo's own backend at **`api-new.silkgo.ge/api/v1`** — **NOT** Tvibo. (`api.tvibo.com` is abandoned/dead; the old tv-new bundle that referenced it is stale.) **All shapes below were VERIFIED against live traffic 2026-06-21** (Playwright capture + curl replication from a normal machine). CORS is `*`, so browser/localhost calls work; auth is the guest bearer + `X-APP-GUEST: true`.

Format is JSON:API: `{ "data": [ { "type", "id", "attributes": {...}, "relationships": {...} } ] }`.

## Operations

| Method | Path | Returns |
|--------|------|---------|
| `getChannels()` | `GET /channel?type=tv` | 142 channels. Each: `id`=UUID, `attributes.slug` (stream key, e.g. `silk_sport4`), `name`, `sort` (display number), `recordingDuration` (DVR seconds), `rewindAllowed`/`hasEPG`, `relationships.logo.data…sizes.data["100x100"|"original"].attributes.url` |
| `getLiveStreamUrl(slug)` | `GET /channel/chunk/{slug}` | `{attributes:{live:true, file:"https://silkNN-edgeNN.itdc.ge/{slug}/index.m3u8?token=…"}}` — tokenized HLS on the itdc.ge CDN |
| `getPrograms(uuid, startDate, endDate)` | `GET /programs?channelId={uuid}&shift=enabled&thumbs=enabled&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | Programs: `attributes.{name, startTime, finishTime, description, thumbMp4}`; times `YYYY-MM-DD HH:mm:ss` in **Asia/Tbilisi**. ⚠ Use **date-only `startDate`/`endDate`** to select whole days (yesterday→today for catch-up); the `startDateTime`/`endDateTime` variants are ignored and always return today. |
| `getCatchupStreamUrl(slug, datetime)` | `GET /channel/chunk/{slug}?datetime=YYYY-MM-DD HH:mm:ss&center=false&allowProgressive=true` | **VERIFIED**: for a time older than the ~6–8h live window, returns `{live:false, file:".../index-{startTs}-{dur}.m3u8?token=…"}` — a windowed archive playlist that plays. Within the live window it returns `live:true` (no deep seek). |
| `getDvrGaps(slug, from, to)` | `GET /channel/{slug}/dvr-gaps?from=…&to=…` | `{attributes:{ranges:[…]}}` — empty `ranges` = full catch-up available across the window |
| `getServerTime()` | `GET /applicationinfo/server-time` | `{attributes:{timestamp, dateTime, timezone}}` — drives TimeService drift + tz offset |

## Behavioral notes
- **Channel key duality**: stream/DVR use `slug`; EPG (`programs`) uses the UUID `id`. The `Channel` renderer model carries both.
- **Stream**: `channel/chunk/{slug}` returns live by default. Time-shift/catch-up (US3) uses the same family with a seek/position; confirm exact param against live traffic when building US3.
- **Timezone**: program times are Tbilisi-local; convert via the server-time tz offset, not the device clock.
- **Catch-up availability**: from `recordingDuration` (window length) + `dvr-gaps` (holes). `rewindAllowed:false` → no catch-up.

## Error contract
- `401` → refresh the Silkgo guest token once, retry; then surface a session error.
- Missing `?type=tv` on `/channel` → `401 "wrong client settings credentials"` (this was the earlier red herring).
- Stream geo/unplayable → `playerStore.error` with a localized kind (FR-009); user can hop channels.
- Empty EPG → `"No program information"` placeholder, not an error.
