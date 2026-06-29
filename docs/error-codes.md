# Error codes by namespace

Every rejection is an instance of a namespace-specific subclass (`AuthError`, `AppRemoteError`, …) extending the abstract `SpotifyError` base. Catch with `instanceof` for typed `code` narrowing.

Auth native → JS mapping details: [auth-error-mapping.md](./auth-error-mapping.md).

App Remote native → JS mapping details: [app-remote-error-mapping.md](./app-remote-error-mapping.md).

### `AuthErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `USER_CANCELLED` | User closed auth or `Auth.cancelPending()` ran | Benign — no action |
| `AUTH_IN_PROGRESS` | Concurrent `Auth.authenticate()` or iOS stuck pending auth | `await Auth.cancelPending()` then retry |
| `INVALID_CONFIG` | Missing `clientID`, empty `scopes`, or bad plugin setup | Fix config plugin / `app.config`; run `expo prebuild` |
| `NETWORK_ERROR` | Device cannot reach `tokenSwapURL` / `tokenRefreshURL` | Check dev server URL, HTTPS, device network |
| `TOKEN_SWAP_FAILED` | Swap server returned non-2xx | Fix server; read status + body in `e.message`. On `Auth.refresh()`, an `invalid_grant` body means the refresh token expired or was revoked (Spotify expires them 6 months after issue, from 2026-07-20) — discard the token and re-authenticate, don't retry |
| `TOKEN_SWAP_PARSE_ERROR` | Swap response was not valid token JSON | Fix server response shape |
| `SPOTIFY_NOT_INSTALLED` | Spotify app not found (rare — web fallback may still run) | Prompt install or use web auth |
| `AUTH_ERROR` | Spotify rejected the authorization | Check Dashboard redirect URI, scopes, test users |
| `UNKNOWN` | Unexpected native failure | Read `e.message` / `e.cause`; file an issue with logs. On iOS before Expo SDK 57 a real code (e.g. `USER_CANCELLED`) can surface as `UNKNOWN` with the correct message — see the [known iOS limitation](./auth-error-mapping.md#known-ios-limitation-code-dropped-on-async-rejection-expo--sdk-57) |

### `AppRemoteErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `CONNECTION_FAILED` | `connect()` failed (app missing, refused, handshake error) | Try `AppRemote.authorizeAndPlay(token)` if Spotify may be suspended; otherwise foreground Spotify and retry `connect()`; re-auth if token stale |
| `CONNECTION_LOST` | Connection dropped mid-session | `AppRemote.connect()` again with fresh token |
| `NOT_CONNECTED` | `AppRemote.*` called before connect completed | `await AppRemote.connect()` first |
| `UNKNOWN` | Unexpected IPC failure | Read `e.message`; retry connect |

### `PlayerErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `NOT_CONNECTED` | `Player.*` before `AppRemote.connect()` | Connect App Remote first |
| `CONNECTION_LOST` | Dropped during a player call | Reconnect, then retry |
| `PREMIUM_REQUIRED` | `canPlayOnDemand === false` (Free tier) | Upgrade account or use shuffle/context play only |
| `INVALID_URI` | URI failed validation | Use `SpotifyURI.from()` |
| `INVALID_PARAMETER` | Bad argument (e.g. negative seek) | Fix caller |
| `OPERATION_NOT_ALLOWED` | Player restriction (can't skip, etc.) | Check `PlayerState` restrictions |
| `UNKNOWN` | Other native player error | Read `e.message` |

### `UserErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `NOT_CONNECTED` | `User.*` before connect | Connect App Remote first |
| `CONNECTION_LOST` | Dropped during user API call | Reconnect |
| `INVALID_URI` | Bad library URI | Use `SpotifyURI.from()` |
| `OPERATION_NOT_ALLOWED` | Save/remove blocked (tier, region) | Check `LibraryState.canAdd` / capabilities |
| `UNKNOWN` | Other native user error | Read `e.message` |

### `ContentErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `NOT_CONNECTED` | `Content.*` before connect | Connect App Remote first |
| `CONNECTION_LOST` | Dropped during browse | Reconnect |
| `CONTENT_API_UNAVAILABLE` | Spotify app too old for Content API | Update Spotify app |
| `UNKNOWN` | Other content error | Read `e.message` |

### `ImagesErrorCode`

| Code | When | What to do |
| --- | --- | --- |
| `NOT_CONNECTED` | `Images.load()` before connect | Connect App Remote first |
| `INVALID_URI` | Item has no loadable image | Skip artwork or use placeholder |
| `IMAGE_LOAD_FAILED` | Spotify or disk write failed | Retry; check free space |
| `UNKNOWN` | Other image error | Read `e.message` |

