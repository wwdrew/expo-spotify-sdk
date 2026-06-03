# App Remote error mapping

Canonical matrix for mapping native Spotify App Remote failures to the public JS error codes (`PlayerError`, `UserError`, `ContentError`, `ImagesError`).

**Machine-readable fixture:** [`src/internal/app-remote-error-mapping.fixture.json`](../src/internal/app-remote-error-mapping.fixture.json) — validated by [`src/internal/__tests__/app-remote-error-mapping.test.ts`](../src/internal/__tests__/app-remote-error-mapping.test.ts).

**Native implementations:**

| Platform | File |
| --- | --- |
| iOS | [`ios/SpotifyAppRemoteErrorMapping.swift`](../ios/SpotifyAppRemoteErrorMapping.swift) |
| Android | [`android/src/main/java/expo/modules/spotifysdk/SpotifyAppRemoteErrorMapping.kt`](../android/src/main/java/expo/modules/spotifysdk/SpotifyAppRemoteErrorMapping.kt) |

## Mapping strategy

Both platforms follow the same priority order:

1. **Typed native signals** — structured SDK error codes (iOS `SPTAppRemoteErrorCode`) or exception classes (Android `SpotifyConnectionTerminatedException`, `RemoteClientException`, …).
2. **Message heuristics** — shared substring checks (`premium`, `disconnected`, `not allowed`, …) when the SDK only surfaces a generic failure.
3. **`UNKNOWN`** — fallback when nothing else matches.

`NOT_CONNECTED` is thrown synchronously by coordinators when App Remote is not connected — it is not part of the async native-error mapping path.

## Player (`PlayerErrorCode`)

| Code | iOS signal | Android signal | Message fallback |
| --- | --- | --- | --- |
| `CONNECTION_LOST` | `connectionTerminatedError` | `SpotifyConnectionTerminatedException`, `SpotifyDisconnectedException` | `disconnected`, `not connected` |
| `PREMIUM_REQUIRED` | `requestFailedError` + `premium` | — | `premium` |
| `INVALID_PARAMETER` | `invalidArgumentsError` | `RemoteClientException` / protocol errors + `invalid` | — |
| `OPERATION_NOT_ALLOWED` | `requestFailedError` + restriction | — | `not allowed`, `restriction` |
| `UNKNOWN` | anything else | anything else | — |

## User (`UserErrorCode`)

| Code | iOS signal | Android signal | Message fallback |
| --- | --- | --- | --- |
| `CONNECTION_LOST` | `connectionTerminatedError` | connection-terminated exceptions | `disconnected`, `not connected` |
| `INVALID_URI` | `invalidArgumentsError` | protocol errors + `uri` / `invalid` | — |
| `OPERATION_NOT_ALLOWED` | `requestFailedError` + restriction | — | `not allowed`, `restriction` |
| `UNKNOWN` | anything else | anything else | — |

## Content (`ContentErrorCode`)

| Code | iOS signal | Android signal | Message fallback |
| --- | --- | --- | --- |
| `CONNECTION_LOST` | `connectionTerminatedError` | connection-terminated exceptions | `disconnected`, `not connected` |
| `CONTENT_API_UNAVAILABLE` | `requestFailedError` + unsupported | protocol errors + unsupported | `not supported`, `unsupported` |
| `UNKNOWN` | anything else | anything else | — |

## Images (`ImagesErrorCode`)

| Code | iOS signal | Android signal | Message fallback |
| --- | --- | --- | --- |
| `NOT_CONNECTED` | `connectionTerminatedError` | connection-terminated exceptions | `disconnected`, `not connected` |
| `INVALID_URI` | `invalidArgumentsError` | protocol errors + `invalid` | — |
| `IMAGE_LOAD_FAILED` | `requestFailedError` | protocol errors (any other request failure) | — |
| `UNKNOWN` | anything else | anything else | — |

## When adding a new code

1. Add the code to the TypeScript error union (`src/*/error.ts`).
2. Update the fixture JSON and both native mappers.
3. Extend the fixture test expected arrays.
4. Document the code in [`docs/error-codes.md`](./error-codes.md).
