# Platform differences

Cross-platform parity notes for Auth and App Remote.

| Topic | iOS | Android |
| --- | --- | --- |
| `AppRemote.connect(accessToken)` | Token passed to `SPTAppRemote` | Token accepted for API parity; SDK uses session cached in Spotify app from prior auth |
| `Auth.cancelPending()` | Clears stuck `SPTSessionManager` state | No-op |
| Refresh token without swap | Possible (iOS TOKEN flow) | Not available — use `tokenSwapURL` |
| `session.scopes` without swap | Granted scopes returned | Requested scopes only (not granted list) |
| Premium / player metadata | Full App Remote when Premium | Free accounts often lack track titles / on-demand play |
| Content / Images | Requires recent Spotify app | Same |

## Android implicit (TOKEN) flow is not recommended

When `Auth.authenticate()` is called on Android **without** a `tokenSwapURL`, the Spotify Android SDK uses the implicit (TOKEN) flow. This flow has two hard limitations that **will not be fixed** — Spotify has deprecated it:

1. **No `refreshToken`.** The Android SDK does not expose a refresh token for implicit grants. `session.refreshToken` will always be `null`.
2. **`scopes` reflects what was requested, not what was granted.** The Android SDK does not return the actual granted scope list for TOKEN responses.

The library emits a one-time `console.warn` at runtime when this path is taken.

**The fix:** provide a `tokenSwapURL` to use the Authorization Code flow, which returns a full `refreshToken` and the actual granted `scopes` on both platforms.

See [Spotify's migration guide](https://developer.spotify.com/documentation/android/tutorials/migration-token-code) for context, and the [token swap server guide](./token-swap-server.md) for a reference implementation.
