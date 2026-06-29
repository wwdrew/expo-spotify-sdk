# Auth error mapping

Canonical matrix for mapping native Spotify authentication failures to the public JS `AuthErrorCode` values.

**Native implementations:**

| Platform | Auth flow | Token swap / refresh |
| --- | --- | --- |
| iOS | [`ios/SpotifyAuthErrorMapping.swift`](../ios/SpotifyAuthErrorMapping.swift) (`SpotifyAuthErrorMapping.classify`) | [`ios/SpotifyTokenRefreshClient.swift`](../ios/SpotifyTokenRefreshClient.swift) |
| Android | [`android/.../ExpoSpotifySDKModule.kt`](../android/src/main/java/expo/modules/spotifysdk/ExpoSpotifySDKModule.kt) (`authenticateAsync`) | [`android/.../SpotifyTokenSwapClient.kt`](../android/src/main/java/expo/modules/spotifysdk/SpotifyTokenSwapClient.kt) |

**Shared error taxonomy:** [`android/.../SpotifyErrors.kt`](../android/src/main/java/expo/modules/spotifysdk/SpotifyErrors.kt) (Android `CodedException` classes) and `SpotifyError` in [`ios/SpotifyError.swift`](../ios/SpotifyError.swift) (iOS).

## Mapping strategy

Both platforms target the same `AuthErrorCode` for the scenarios below. **Strong-parity** scenarios guarantee an exact match; **best-effort** scenarios aim for the same code but iOS may fall back to `UNKNOWN` in edge cases (see [Parity guarantees](#parity-guarantees)). Priority order:

1. **Typed native signals** — Android `AuthorizationResponse.Type.*`; iOS cancellation domain/code pairs (`NSURLErrorCancelled`, `ASWebAuthenticationSession` canceled login, …).
2. **Owned HTTP client path** — Android `SpotifyTokenSwapClient` and iOS `SpotifyTokenRefreshClient` classify swap/refresh failures directly (`NETWORK_ERROR`, `TOKEN_SWAP_FAILED`, `TOKEN_SWAP_PARSE_ERROR`).
3. **Heuristic auth mapping (iOS authenticate only)** — When `tokenSwapURL` is configured, iOS treats ambiguous `SPTSessionManager` failures as token-swap class errors before falling back to `UNKNOWN`. Network errors in the underlying `NSError` chain map to `NETWORK_ERROR`; OAuth-style rejection text maps to `AUTH_ERROR`.
4. **`UNKNOWN`** — Fallback when nothing else matches. Both platforms wrap unexpected throwables and emit `didFail` with `UNKNOWN`.

### Parity guarantees

| Area | Parity |
| --- | --- |
| `refreshSessionAsync` (swap client) | **Strong** — both platforms own the HTTP request and JSON parsing. |
| `authenticateAsync` without `tokenSwapURL` | **Strong** — direct SDK response / cancellation mapping. |
| `authenticateAsync` with `tokenSwapURL` | **Best-effort** — Android performs the swap in-module; iOS delegates swap to Spotify iOS SDK and classifies wrapped `NSError` signals. Same codes in common cases; edge-case classification may differ. |

## Known iOS limitation: `code` dropped on async rejection (Expo &lt; SDK 57)

On iOS with the new architecture, `expo-modules-core` stringified async-function
promise rejections, discarding the structured `code` carried by the thrown
`Exception` (the `reason`/message survived). A native `USER_CANCELLED` therefore
reached JS with the correct **message** but **no `code`**, so `Auth.authenticate()`
surfaced it as `UNKNOWN` (e.g. `[Auth] UNKNOWN: Authentication was cancelled by the user`).

This is **not** a classification bug — the native classifier emits the right code
(visible in the `[ExpoSpotifySDK] classifyAuthError classified=…` log). The loss
happens in the runtime's promise-rejection bridge. Note the asymmetry: the
`onSessionChange` `didFail` event carries `code` as event data and is **unaffected**,
so the event reports the correct code while the rejected promise does not.

**Fix:** [expo/expo#47259](https://github.com/expo/expo/pull/47259) is **merged**
and ships in **Expo SDK 57**. It routes thrown `Exception`s through the
code-preserving conversion in `JavaScriptPromise.reject`. On SDK 57+ no change to
this SDK is needed — the code we already emit reaches JS intact, and
`Auth.authenticate()` rejects with the accurate `AuthError.code`.

**Interim options on Expo SDK 56 and earlier:**

- `patch-package` `expo-modules-core` with the change from #47259 (apply the same
  edit to your installed SDK's `JavaScriptPromise` reject path), or
- read the code from the `onSessionChange` `didFail` event (unaffected by this bug)
  instead of relying solely on the `Auth.authenticate()` rejection.

## Scenario matrix

Use this table when changing auth code. **Expected code** is the target `error.code` JS should receive (`onSessionChange` `didFail.error.code`). For strong-parity rows both platforms guarantee this code; for best-effort rows (`authenticateAsync` with `tokenSwapURL`) iOS may emit `UNKNOWN` in edge cases — see the iOS signal column and [Parity guarantees](#parity-guarantees).

### `authenticateAsync`

| Scenario | Expected code | Android signal | iOS signal |
| --- | --- | --- | --- |
| User dismisses auth UI | `USER_CANCELLED` | `Type.CANCELLED`, `Type.EMPTY` | Cancellation domain/code or auth-domain cancel text |
| `Auth.cancelPending()` while in flight | `USER_CANCELLED` | N/A (mutex released on return) | `cancelPending()` → `SpotifyError.userCancelled` |
| Second concurrent `authenticateAsync` | `AUTH_IN_PROGRESS` | `AuthInProgressException` | `SpotifyError.authInProgress` |
| Empty `scopes` | `INVALID_CONFIG` | `InvalidConfigException` | `SpotifyError.invalidConfiguration` |
| Missing plugin / manifest config | `INVALID_CONFIG` | `InvalidConfigException` (manifest) | `SpotifyError.invalidConfiguration` (Info.plist) |
| CODE response but no `tokenSwapURL` | `INVALID_CONFIG` | `InvalidConfigException` | N/A (iOS always uses SDK swap when URL set) |
| Spotify returns `Type.ERROR` | `AUTH_ERROR` | `SpotifyAuthErrorException(response.error)` | OAuth / auth rejection heuristics on wrapped error |
| TOKEN response missing access token | `TOKEN_SWAP_PARSE_ERROR` | `TokenSwapParseException` | SDK parse failure → heuristic or `UNKNOWN` |
| CODE response missing code | `TOKEN_SWAP_PARSE_ERROR` | `TokenSwapParseException` | SDK failure → heuristic or `UNKNOWN` |
| Invalid `tokenSwapURL` string | `INVALID_CONFIG` | `InvalidConfigException` (URL parse) | URL set on `SPTConfiguration`; invalid URL surfaces via SDK → heuristic |
| Swap server unreachable | `NETWORK_ERROR` | `NetworkException` (OkHttp `IOException`) | `NSURLErrorDomain` in error chain |
| Swap server HTTP 4xx/5xx | `TOKEN_SWAP_FAILED` | `TokenSwapFailedException(status, body)` | HTTP status in error detail, or `TOKEN_SWAP_FAILED` when swap URL configured |
| Swap server empty / non-JSON body | `TOKEN_SWAP_PARSE_ERROR` | `TokenSwapParseException` | Parse/json/decode heuristic when swap URL configured |
| Swap JSON missing `access_token` / `expires_in` | `TOKEN_SWAP_PARSE_ERROR` | `TokenSwapParseException` | Parse heuristic or `UNKNOWN` |
| Unclassified SDK / runtime failure | `UNKNOWN` | `UnknownSpotifyException` | `SpotifyError.underlying` |

### `refreshSessionAsync`

| Scenario | Expected code | Android signal | iOS signal |
| --- | --- | --- | --- |
| Blank `refreshToken` or `tokenRefreshURL` | `INVALID_CONFIG` | `InvalidConfigException` | `SpotifyError.invalidConfiguration` |
| Invalid refresh URL string | `INVALID_CONFIG` | `InvalidConfigException` | `SpotifyRefreshError.invalidURL` → `INVALID_CONFIG` |
| Refresh server unreachable | `NETWORK_ERROR` | `NetworkException` | `SpotifyRefreshError.network` → `NETWORK_ERROR` |
| Refresh token expired or revoked (`invalid_grant`) | `REFRESH_TOKEN_EXPIRED` | `RefreshTokenExpiredException` (body contains `invalid_grant`) | `SpotifyRefreshError.refreshTokenExpired` → `REFRESH_TOKEN_EXPIRED` |
| Refresh server HTTP 4xx/5xx (other than `invalid_grant`) | `TOKEN_SWAP_FAILED` | `TokenSwapFailedException` | `SpotifyRefreshError.http` → `TOKEN_SWAP_FAILED` |
| Refresh empty / non-JSON / bad shape | `TOKEN_SWAP_PARSE_ERROR` | `TokenSwapParseException` | `SpotifyRefreshError.parse` → `TOKEN_SWAP_PARSE_ERROR` |
| Unclassified failure | `UNKNOWN` | `UnknownSpotifyException` | Uncaught → `UNKNOWN` via module bridge |

## Manual verification checklist

Run on **both** iOS and Android with the example app and a controllable token-swap server (or temporary route that returns fixed responses).

- [ ] **Happy path** — `authenticateAsync` with valid swap URL returns session; no `didFail` event.
- [ ] **User cancel** — dismiss auth UI → `USER_CANCELLED`, message mentions cancellation.
- [ ] **Swap 500** — server returns HTTP 500 → `TOKEN_SWAP_FAILED`, message includes status (and body snippet on Android).
- [ ] **Swap invalid JSON** — server returns `200` with `{ "oops": true }` → `TOKEN_SWAP_PARSE_ERROR`.
- [ ] **Swap offline** — stop server or use unreachable host → `NETWORK_ERROR`.
- [ ] **Bad swap URL** — `not-a-url` → `INVALID_CONFIG`.
- [ ] **Refresh expired** — expired/revoked refresh token (server forwards Spotify's `invalid_grant`) → `REFRESH_TOKEN_EXPIRED`. Other refresh 4xx/5xx → `TOKEN_SWAP_FAILED`.
- [ ] **Concurrent auth** — fire two `authenticateAsync` calls → second rejects `AUTH_IN_PROGRESS`.

**iOS logs:** filter for `[ExpoSpotifySDK] classifyAuthError classified=` to see native classification during `authenticateAsync` (emitted for both the delegate path and the module-level catch-all).

**JS event:** every failure should emit `onSessionChange` with `type: "didFail"` and matching `error.code` before the promise rejects.

## When changing auth error mapping

1. Update **both** iOS (`SpotifyAuthErrorMapping.swift` / `SpotifyError.swift` / `SpotifyTokenRefreshClient.swift`) and Android (`ExpoSpotifySDKModule.kt` / `SpotifyTokenSwapClient.kt` / `SpotifyErrors.kt`). Mirror any code-set or priority change in [`src/internal/auth-error-mapping.fixture.json`](../src/internal/auth-error-mapping.fixture.json).
2. Update this matrix if scenario → code mapping changes.
3. Document new codes in [`docs/error-codes.md`](./error-codes.md).
4. Run through the manual checklist above on both platforms before merging.
