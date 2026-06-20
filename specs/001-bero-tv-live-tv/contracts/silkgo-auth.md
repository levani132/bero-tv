# Contract: SilkgoAuthClient

Mints and refreshes the platform token used to authorize Tvibo calls. Host `https://api-new.silkgo.ge/api/v1`. **Guest mint is verified live (2026-06-21).**

## Operations

### `mintGuestToken(): Promise<TokenResponse>`
```
POST /auth/token
Headers: Content-Type: application/json · Accept: application/json · X-APP-GUEST: true · Accept-Language: ka
Body:    { "grant_type": "client_implicit", "client_id": "7" }
200 →    { "token_type":"Bearer", "expires_in":86400, "access_token":"<JWT>" }
```
- No username/password/cookie. `access_token` is an RS256 JWT (`aud:"7"`, `sub:""`, `scopes:[]`).
- **Do NOT use `silk_implicit`** — that is the user OTP login (returns `202 otpCodeSentPasswordConfirmRequired`).

### `refresh(refreshToken): Promise<TokenResponse>`
```
POST /auth/token
Body: { "grant_type":"refresh_token", "refresh_token":"<rt>", "client_id":"11" }
```

## Error contract
- `401 {"message":"auth.unauthenticated"}` → token invalid/expired → trigger refresh-or-remint.
- `401 {"message":"Authentication failed due to wrong client settings credentials!"}` → client-tier rejection (wrong client_id / endpoint).
- Network failure → surfaced to `sessionStore` as retryable; never blanks the app.

## Consumer expectations
- Persist `{access_token, expires_in→expiresAt, refresh_token?}` to `localStorage` (R6).
- Reuse while `now < expiresAt`; refresh proactively before expiry and reactively on a 401 (one retry).
