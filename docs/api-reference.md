# API reference

Full method and type documentation for the public `@wwdrew/expo-spotify-sdk` surface.

### `Auth`

#### `Auth.isAvailable(): boolean`

Returns `true` if the Spotify app is installed. Does not throw (not available on unsupported platforms).

#### `Auth.authenticate(config): Promise<SpotifySession>`

Starts OAuth via the installed Spotify app (or web fallback). Throws [`AuthError`](#autherror) on failure.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `scopes` | `SpotifyScope[]` | ✅ | At least one scope. Include `app-remote-control` for App Remote. |
| `tokenSwapURL` | `string` | — | Code flow + server swap (recommended). Required on Android for a `refreshToken`. |
| `tokenRefreshURL` | `string` | — | Refresh endpoint for iOS SDK and `Auth.refresh()`. |
| `showDialog` | `boolean` | — | Force the consent screen. Default `false`. |

| Return field | Type | Description |
| --- | --- | --- |
| `accessToken` | `string` | Bearer token for Web API and `AppRemote.connect()`. |
| `refreshToken` | `string \| null` | `null` on Android without `tokenSwapURL`. |
| `expirationDate` | `number` | Expiry as Unix epoch **milliseconds**. |
| `scopes` | `SpotifyScope[]` | Granted scopes (requested-only on Android TOKEN flow). |

#### `Auth.cancelPending(): Promise<void>`

Cancels an in-flight `Auth.authenticate()`. On iOS, call before retrying if you see `AUTH_IN_PROGRESS` after a dropped redirect. No-op on Android.

```ts
await Auth.cancelPending();
const session = await Auth.authenticate({ scopes: ["streaming"] });
```

A cancelled call rejects with `AuthError` `code: "USER_CANCELLED"`.

#### `Auth.refresh(config): Promise<SpotifySession>`

Exchanges a refresh token via your refresh server. Pass through `scopes` from the previous session when the refresh response omits `scope`.

```ts
const refreshed = await Auth.refresh({
  refreshToken: previous.refreshToken!,
  tokenRefreshURL: "https://your-server.example.com/refresh",
  scopes: previous.scopes,
});
```

#### `Auth.addListener("sessionChange", listener): Subscription`

Central place to persist tokens. Fires for every `authenticate` / `refresh` — including calls you did not `await`.

| `type` | Payload | When |
| --- | --- | --- |
| `"didInitiate"` | `{ session }` | `Auth.authenticate()` succeeded |
| `"didRenew"` | `{ session }` | `Auth.refresh()` succeeded |
| `"didFail"` | `{ error: { code, message } }` | Either call failed |

#### `AuthError`

```ts
import { Auth, AuthError } from "@wwdrew/expo-spotify-sdk";

try {
  await Auth.authenticate({ scopes: ["streaming"] });
} catch (e) {
  if (e instanceof AuthError) {
    switch (e.code) {
      case "USER_CANCELLED":
      case "AUTH_IN_PROGRESS":
        return;
      case "INVALID_CONFIG":
      case "NETWORK_ERROR":
      case "TOKEN_SWAP_FAILED":
      case "TOKEN_SWAP_PARSE_ERROR":
      case "SPOTIFY_NOT_INSTALLED":
      case "AUTH_ERROR":
      case "UNKNOWN":
        reportError(e);
    }
  }
}
```

`e.message` is the native reason string. On iOS `UNKNOWN` auth failures, the message includes the full `NSError` chain (e.g. `NSURLErrorDomain` to your `tokenSwapURL`). `e.cause` retains the original error for logging.

### `AppRemote`

Connects to the **running** Spotify app. All `Player`, `User`, `Content`, and `Images` calls require an active connection.

| Method | Description |
| --- | --- |
| `connect(accessToken)` | Open IPC to Spotify. Resolves when connected. |
| `disconnect()` | Tear down connection. |
| `isConnected()` | Synchronous snapshot. |
| `getConnectionState()` | `"disconnected"` \| `"connecting"` \| `"connected"`. |
| `addListener("connectionStateChange", cb)` | State transitions. |
| `addListener("connectionError", cb)` | Failures and drops (`AppRemoteError` codes). |

**Platform notes:**

- **iOS:** pass the access token from `Auth.authenticate()`. If connect fails with `CONNECTION_FAILED` / `Connection refused` (`NSPOSIXErrorDomain` 61), bring Spotify to the foreground and retry — backgrounded Spotify often has no transport listener yet.
- **Android:** `accessToken` is accepted for API parity; the SDK uses the session cached in the Spotify app from your prior `Auth.authenticate()` call.

Calling `connect()` while already connected is a no-op.

### `Player`

- `Player.play(uri)`
- `Player.pause()`
- `Player.resume()`
- `Player.skipNext()`
- `Player.skipPrevious()`
- `Player.seekTo(positionMs)`
- `Player.setShuffle(enabled)`
- `Player.setRepeatMode(mode)`
- `Player.setPodcastPlaybackSpeed(speed)`
- `Player.queue(uri)`
- `Player.getPlayerState()`
- `Player.getCrossfadeState()`
- `Player.addListener("playerStateChange", cb)`

### `User`

- `User.getCapabilities()`
- `User.getLibraryState(uri)`
- `User.addToLibrary(uri)`
- `User.removeFromLibrary(uri)`
- `User.addListener("capabilitiesChange", cb)`
- `User.addLibraryStateListener(uri, cb)`

### `Content`

- `Content.getRecommendedContentItems(type)`
- `Content.getChildren(item)`

### `Images`

- `Images.load(item, size)`

### Hooks

Built on `useSyncExternalStore` over the native event streams. Subscribe in any component; no manual `addListener` cleanup required.

- `useSession()` — latest `SpotifySession` from auth events (or `null`)
- `useConnectionState()` — `disconnected` \| `connecting` \| `connected`
- `usePlayerState()` — full player snapshot
- `useCurrentTrack()` / `useIsPlaying()` / `usePlaybackPosition()` — derived from player state
- `useCapabilities()` — `canPlayOnDemand` and related flags
- `useLibraryState(uri)` — save state for one URI

