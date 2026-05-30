# Token swap server

The `tokenSwapURL` / `tokenRefreshURL` endpoints must be a server you control — **never** put your Spotify `CLIENT_SECRET` in the app bundle.

### Swap endpoint (`POST {tokenSwapURL}`)

The native module sends a `application/x-www-form-urlencoded` body:

```
code=<authorization-code>&redirect_uri=<redirect-uri>&client_id=<client-id>
```

Your server POSTs these to `https://accounts.spotify.com/api/token` with `grant_type=authorization_code` and your `CLIENT_SECRET` in the `Authorization` header, then returns Spotify's response verbatim as `application/json`:

```json
{
  "access_token": "BQA...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "AQA...",
  "scope": "user-read-email streaming"
}
```

### Refresh endpoint (`POST {tokenRefreshURL}`)

The native module sends:

```
refresh_token=<token>&client_id=<client-id>
```

Your server POSTs to `https://accounts.spotify.com/api/token` with `grant_type=refresh_token`. Return Spotify's response verbatim. If Spotify rotates the refresh token the response will contain a new `refresh_token`; if not, the field is absent — the library handles both cases correctly.

### Error responses

Return a non-2xx HTTP status with a JSON body for structured error propagation. The library will reject with `TOKEN_SWAP_FAILED` and include the status code and (truncated) response body in `e.message`.

### Reference implementation

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
