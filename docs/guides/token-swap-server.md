# Token swap server

The `tokenSwapURL` / `tokenRefreshURL` endpoints must be a server you control — **never** put your Spotify `CLIENT_SECRET` in the app bundle.

Think of this server as a small OAuth bridge:

1. The native SDK sends your backend an auth artifact (`code` or `refresh_token`).
2. Your backend exchanges that artifact with Spotify Accounts.
3. Your backend returns Spotify's JSON token payload to the app.

## Server-side values to keep internally

Store these on the server (env/config), not in mobile code:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` (must match the redirect URI registered in Spotify Dashboard and used during auth)

## What the endpoints must do

- Accept `application/x-www-form-urlencoded` requests from the SDK.
- Validate required input (`code` for swap, `refresh_token` for refresh).
- Call Spotify `https://accounts.spotify.com/api/token` with the correct `grant_type`.
- Authenticate to Spotify using your app credentials (typically Basic auth header built from Base64-encoded `client_id:client_secret`).
- Return Spotify's JSON token response to the SDK.

## Swap endpoint (`POST {tokenSwapURL}`)

The native SDK sends an `application/x-www-form-urlencoded` body:

```text
code=<authorization-code>
```

When your server exchanges the code with Spotify Accounts, include
`redirect_uri` and ensure it matches the redirect URI used in the original
authorization request (for example, from `SPOTIFY_REDIRECT_URI` in env).

Your server POSTs to `https://accounts.spotify.com/api/token` with
`grant_type=authorization_code`, the authorization `code`, the matching
`redirect_uri`, and your `CLIENT_SECRET` in the `Authorization` header, then
returns Spotify's response verbatim as `application/json`:

Request shape to Spotify Accounts:

```text
POST https://accounts.spotify.com/api/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
code=<authorization-code>
redirect_uri=<exact redirect URI used in authorize step>
```

Header construction detail:

```text
credentials = base64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
Authorization = `Basic ${credentials}`
```

```json
{
  "access_token": "BQA...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "AQA...",
  "scope": "user-read-email streaming"
}
```

## Refresh endpoint (`POST {tokenRefreshURL}`)

The native module sends:

```text
refresh_token=<token>
```

Your server POSTs to `https://accounts.spotify.com/api/token` with
`grant_type=refresh_token` and the `refresh_token` value, then returns Spotify's
response verbatim. If Spotify rotates the refresh token the response will
contain a new `refresh_token`; if not, the field is absent — the library
handles both cases correctly.

Request shape to Spotify Accounts:

```text
POST https://accounts.spotify.com/api/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
refresh_token=<previous refresh token>
```

## Error responses

Return a non-2xx HTTP status with a JSON body for structured error propagation. The library will reject with `TOKEN_SWAP_FAILED` and include the status code and (truncated) response body in `e.message`.

**Expired or revoked refresh tokens.** From July 20, 2026 Spotify expires refresh tokens six months after they are issued. A refresh attempt with an expired or revoked token returns HTTP `400` with `{"error":"invalid_grant"}`. Forward Spotify's status and body **verbatim** on the refresh endpoint so the SDK can detect `invalid_grant` and reject with the dedicated `REFRESH_TOKEN_EXPIRED` code, letting the app route the user back through sign-in — see [Refreshing the session and handling token expiry](../../README.md#refreshing-the-session-and-handling-token-expiry). Do not transform these into a 200 response, or the app cannot tell a dead token from a successful refresh.

## Reference implementation

The example app uses [Expo Router API routes](https://docs.expo.dev/router/reference/api-routes/) for the swap and refresh endpoints — no separate server process needed.

**Before running the example, you need a Spotify app:**

> **Note (February 2026 onwards):** Spotify now requires the app owner to have an active **Spotify Premium** subscription to use Development Mode apps. Development Mode apps are also limited to **5 test users** — each user must be explicitly added in your Dashboard under **User Management**. See [Spotify's February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) for details.

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app (or use an existing one).
2. In the app settings, under **APIs used**, enable **Web API** (required for the `/v1/me` profile call).
3. Under **Redirect URIs**, add `expo-spotify-sdk-example://authenticate` exactly and save.
4. Under **User Management**, add the Spotify accounts that will test the app (up to 5 in Development Mode).

**Then populate the credentials:**

```sh
cd example
cp .env.local.example .env.local
```

Edit `.env.local` — all three values are required:

```sh
# From your Spotify app's dashboard page
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Must match the redirect URI you registered in the Spotify Dashboard
SPOTIFY_REDIRECT_URI=expo-spotify-sdk-example://authenticate
```

`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are shown on your app's dashboard page. `SPOTIFY_CLIENT_SECRET` is revealed by clicking **View client secret**.

**Then run the app:**

```sh
npx expo start
```

The `/swap` and `/refresh` API routes are served by the Expo dev server alongside the app. `Constants.expoConfig.hostUri` auto-detects the correct server URL for any device or simulator — no manual IP configuration needed.
