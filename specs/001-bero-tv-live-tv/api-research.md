# Source Portal API Research: silkgo.ge/tv

> ## ⚠ RESOLVED UPDATE (2026-06-21): live TV is NOT on Tvibo
> The current silkgo TV product **abandoned the Tvibo middleware**. `api.tvibo.com` is dead (refuses all
> connections) and the bundle reference to it is stale. Live TV is served by silkgo's **own backend at
> `api-new.silkgo.ge/api/v1`**, verified end-to-end (Playwright capture + curl). The working endpoints and
> shapes are in **[contracts/silkgo-tv.md](./contracts/silkgo-tv.md)**. The Tvibo sections below (§3.2, §3.3,
> §4) are retained only as a historical record of the old architecture — **do not build against them.**

**Date**: 2026-06-20 (updated 2026-06-21 with live verification)
**Method**: Static reverse-engineering of the public `silkgo.ge` (Next.js) and `tv-new.silkgo.ge` (React) bundles, plus **live probing of the auth endpoint** on 2026-06-21. No private credentials were used. The live-TV middleware host (`api.tvibo.com`) is **geo/IP-restricted to Georgia** (see §3.3) and was unreachable from the verification environment, so its response shapes remain inferred from request construction in the client code.

> **Live-verification note (2026-06-21)**: The guest-token flow was confirmed against the live server and the grant type was found to differ from the original static reading — see §3.1. `api.tvibo.com` reachability was tested from 59 global vantage points; 58 failed (§3.3). All Tvibo response shapes below are still inferred, not captured, and must be confirmed from inside Georgia during planning.

> This document is **supporting evidence** for the specification. It contains implementation/technical detail intentionally kept out of `spec.md`. Treat every concrete value (client IDs, hosts, parameter names) as **observed, not contractual** — they must be re-confirmed against live traffic during `/speckit-plan` before being relied upon.

---

## 1. High-level architecture of the source

Silkgo is a content portal (Georgian: TV, Video/VOD, Radio, Sport, Packages) that appears to be a branded skin over the **myvideo.ge** platform. Live TV is **not** served by Silkgo's own API — it is delegated to the **Tvibo IPTV middleware**.

```
                 silkgo.ge  (Next.js shell, "/tv" route)
                     │  obtains user/guest access token
                     │  from api-new.silkgo.ge
                     ▼
        ┌─────────────────────────────────────────┐
        │  <iframe src="https://tv-new.silkgo.ge"> │   live-TV player app (React)
        └─────────────────────────────────────────┘
                     │  receives parent token via postMessage
                     │  (Authorization: Bearer <token>)
                     ▼
            api.tvibo.com/api   ← channels, EPG, stream URLs, DVR/catch-up
            thumbs01.myvideo.ge/previews/tv/  ← channel preview thumbnails
            HLS (.m3u8) stream URLs returned by Tvibo player endpoints
```

Radio reuses the same iframe app at `tv-new.silkgo.ge/?mode=radio`.

---

## 2. Hosts & environment config (observed in `silkgo.ge` `ENV_CONFIG`)

| Key | Value |
|-----|-------|
| `API_HOST` | `https://api-new.silkgo.ge` |
| `API_BASE_URL` | `https://api-new.silkgo.ge/api/v1` |
| `BASE_URL` | `https://silkgo.ge` |
| `TV_IFRAME_PROD` | `https://tv-new.silkgo.ge` |
| `RADIO_IFRAME_PROD` | `https://tv-new.silkgo.ge/?mode=radio` |
| `THUMBS_URL` | `https://thumbs01.myvideo.ge` |
| `STATIC_URL` | `https://static01.myvideo.ge` |
| `API_CLIENT_ID` | `11` (logged-in client) |
| `API_GUEST_CLIENT_ID` | `7` (guest client) |
| `ALLOWED_PARENT_ORIGINS` | `silkgo.ge`, `new.silkgo.ge`, `*.myvideo.ge` (postMessage origin allowlist) |
| `COOKIE_DOMAIN` | `.myvideo.ge` |

Live-TV middleware base (observed in `tv-new.silkgo.ge`): `//api.tvibo.com/api` (also `panel.tvibo.com`).
Channel previews: `//thumbs01.myvideo.ge/previews/tv/`.

---

## 3. Authentication flow

### 3.1 Portal token (Silkgo / myvideo platform)

OAuth-style token endpoint:

```
POST https://api-new.silkgo.ge/api/v1/auth/token
Headers: Content-Type: application/json   (form-encoded also accepted)
         Accept: application/json
         Accept-Language: <lang>
         X-APP-GUEST: "true" | "false"
Body (guest):              { grant_type: "client_implicit", client_id: "7" }            ← VERIFIED 2026-06-21
Body (user login, step 1): { grant_type: "silk_implicit", username: <email>, client_id: "11" }  → sends OTP
Body (user login, step 2): { grant_type: "silk_implicit", username: <email>, otp_code: <code>, client_id: "11" }
Body (refresh):            { grant_type: "refresh_token", refresh_token: <rt>, client_id: "11" }
```

- **CORRECTION (2026-06-21)**: The guest grant is **`client_implicit`**, not `silk_implicit`. The shell code is `attemptGuestTokenGeneration() → generateToken({ grant_type: "client_implicit", client_id: GUEST_CLIENT_ID })`. `silk_implicit` is the **user login** path: posting it with an email triggers an OTP (`HTTP 202 otpCodeSentPasswordConfirmRequired`). The original draft conflated the two.
- A **guest token** can be minted with no user login, no username, no cookie (`X-APP-GUEST: true`, guest client id `7`). **Confirmed live**: returns an RS256 JWT, `token_type: Bearer`, `expires_in: 86400` (24h), claims `aud:"7"`, `sub:""`, `scopes:[]`. This is the critical enabler for the TV app.
- **Guest scope is thin**: with the guest bearer, `GET /api/v1/video` (VOD) returns `200`, but `home`, `channels`, `categories`, `profile` return `401 {"message":"Authentication failed due to wrong client settings credentials!"}` even with correct `Origin`/`Referer`. That is a *client-tier* gate, not a token failure. (Moot for live TV, which is entirely on Tvibo — see §4.)
- The token is an OAuth bearer with `access_token` + `refresh_token`; the client auto-refreshes.

### 3.2 Tvibo authorization (handed down to the iframe)

The TV iframe (`tv-new.silkgo.ge`) does **not** authenticate independently. Its API client resolves a token via `getAccessToken()` → `parentToken` (passed from the Silkgo shell into the iframe) falling back to its own auth store, and attaches:

```
Authorization: Bearer <token>
```

to every `api.tvibo.com` request. So **Bero TV must obtain a Silkgo token (guest is sufficient) and pass it as a Bearer to the Tvibo middleware.** Whether Tvibo accepts the raw Silkgo token directly or requires a Tvibo-issued token brokered server-side must be confirmed against live traffic during planning — this is the single biggest integration unknown. **(This can only be tested from inside Georgia — see §3.3.)**

### 3.3 Tvibo is geo/IP-restricted to Georgia (VERIFIED 2026-06-21)

`api.tvibo.com` (resolves to `167.99.142.42`, DigitalOcean) **refuses TCP connections on ports 80 and 443** from outside Georgia. Verified two ways:

- Direct `curl` from a non-Georgian host → connection refused on both ports, while myvideo.ge media hosts (`thumbs01`, `open5`, `static01`) responded normally.
- TCP reachability probe from **59 global vantage points**: **58 failed**, only one node connected. The browser calls `api.tvibo.com/api` **directly** (base `//api.tvibo.com/api`); there is **no silkgo proxy** in front of it (the `/api/v1/...` path on `tv-new.silkgo.ge` just serves the SPA shell).

**Operating constraint (accepted):** Bero TV is developed, tested, and operated **entirely within Georgia**. Under that constraint the geo-lock is a non-issue. It does, however, mean the Tvibo API surface and the HLS streams (also presumed geo-locked) **cannot be validated from outside Georgia** — all live-traffic confirmation in this document must be done on a Georgian network.

---

## 4. Live-TV API surface (Tvibo middleware — `api.tvibo.com/api`)

All observed from request construction in the `tv-new.silkgo.ge` bundle.

| Purpose | Method & path | Parameters (observed) |
|---------|---------------|------------------------|
| Server time / sync | `GET applicationinfo/server-time` | — |
| Channel list | `GET channel` | (query object) |
| Channel detail | `GET channel/{id}` | — |
| Recording duration | `GET channel/recordingDuration/{id}` | — |
| DVR availability gaps | `GET channel/{id}/dvr-gaps` | `from=YYYY-MM-DD HH:mm:ss` |
| EPG (program guide) | `GET programs` | `channelId`, `shift=enabled`, `thumbs=enabled`, `startDate/endDate` or `startDateTime/endDateTime` |
| Program search | `GET programs/search` | `keyword`, `channelId`, `channelIds`, `offset`, `limit` |
| Stream sources | `GET player/streams/{...}` | — |
| Stream URL (play) | `GET player/streamurl/{...}` | — |
| Program EPG for player | `GET player/epg/{...}` | — |
| DVR/catch-up file | `GET dvr_getfile.php` | (DVR segment retrieval) |

**Stream format**: HLS (`.m3u8`) returned by `player/streamurl`. Time-shift / catch-up ("shift") and DVR are first-class (programs carry `shift=enabled`, channels expose `dvr-gaps` and `recordingDuration`).

**Content domains** surfaced by the platform: `tv_channel`, `user_channel`, `category`, `program`, `video` (VOD), plus advertising (`open5.myvideo.ge`, `ads2.adributor.tv`).

---

## 5. Implications for Bero TV

1. **Guest-first**: Live TV can be delivered with a guest token (`client_implicit` + guest client id `7`) — no account system needed for an MVP. **Token mint is verified working.** Login (OTP via `silk_implicit` + `otp_code`, client id `11`) can be a later phase for personalization/favorites.
2. **Two-layer integration**: (a) a thin Silkgo auth client for token mint/refresh, (b) a Tvibo client for channels/EPG/streams/DVR.
3. **HLS playback** on Tizen (AVPlay / native `<video>`) and Android TV (ExoPlayer or WebView `<video>`), mirroring how `bero-movies` plays streams.
4. **EPG + time-shift** are available and differentiate a "live TV" app from a simple stream list.
5. **Geo constraint (resolved)**: `api.tvibo.com` and (presumed) the streams are Georgia-only. Bero TV is built/tested/run entirely in Georgia, so this is an accepted operating constraint rather than a blocker — but it means **all Tvibo/stream verification must happen on a Georgian network**.
6. **Risk / open questions to resolve in planning (from inside Georgia)**:
   - Does Tvibo accept the Silkgo bearer token directly, or is there a token-exchange step? *(Single biggest remaining unknown; untestable from outside Georgia.)*
   - Are there per-operator/referer restrictions (the iframe sets `Referer: tv-new.silkgo.ge`, origin allowlists)?
   - DRM restrictions on individual streams (geo is already understood).
   - This is a **proof-of-concept**; redistribution/licensing is a later business gate, not in scope for the demo.

---

## 6. Evidence index (where each fact came from)

- `ENV_CONFIG` block, client IDs, iframe hosts → `silkgo.ge/_next/static/chunks/*.js`
- `/api/v1/auth/token` flows, grant types, `X-APP-GUEST` → same bundle, auth module (`attemptGuestTokenGeneration`, `implicitLoginSendOtp`, etc.).
- **Guest grant = `client_implicit` (corrected)** → shell chunk `attemptGuestTokenGeneration()` + **live mint returning a valid JWT, 2026-06-21**.
- **`silk_implicit` = user login** → live probe returned `HTTP 202 otpCodeSentPasswordConfirmRequired` for an email username.
- **Guest scope** (video=200, home/channels/categories=401 "wrong client settings") → live probes with the guest bearer, 2026-06-21.
- Tvibo base (`fe="//api.tvibo.com/api"`, called directly, no proxy) + endpoint paths + parameters → `tv-new.silkgo.ge/js/main-*.js`, `vendor-*.js`.
- **`api.tvibo.com` geo-lock** → direct connection refused on 80/443 + TCP probe from 59 global nodes (58 fail), 2026-06-21. Its responses remain inferred, not captured.
