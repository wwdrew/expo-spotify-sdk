# expo-spotify-sdk

[![npm version](https://img.shields.io/npm/v/@wwdrew/expo-spotify-sdk)](https://www.npmjs.com/package/@wwdrew/expo-spotify-sdk)
[![CI](https://img.shields.io/github/actions/workflow/status/wwdrew/expo-spotify-sdk/ci.yml?label=CI)](https://github.com/wwdrew/expo-spotify-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/wwdrew/expo-spotify-sdk)](LICENSE)

An Expo module that wraps the native [Spotify iOS SDK](https://github.com/spotify/ios-sdk) (v5.0.1) and [Spotify Android SDK](https://github.com/spotify/android-sdk) (v4.0.1) to provide Spotify Auth + App Remote control in Expo and React Native apps.

**Why this exists:** Spotify ships native SDKs for iOS and Android that enable authentication via the installed Spotify app (no browser redirect, better UX) but there is no maintained Expo module for them. This library fills that gap.

## Table of contents

- [Platform support](#platform-support)
- [Versioning and Expo SDK lanes](#versioning-and-expo-sdk-lanes)
- [Public API (Auth + App Remote)](#public-api-auth--app-remote)
- [Quick start (Expo)](#quick-start-expo)
- [Installation in bare React Native](#installation-in-bare-react-native)
- [Configuration](#configuration)
- [Usage](#usage)
- [Spotify Premium and App Remote](#spotify-premium-and-app-remote)
- [Migration from v0.x](#migration-from-v0x)
- [API reference](#api-reference)
- [Error codes by namespace](#error-codes-by-namespace)
- [Platform differences (parity)](#platform-differences-parity)
- [Android implicit (TOKEN) flow is not recommended](#android-implicit-token-flow-is-not-recommended)
- [Token swap server](#token-swap-server)
- [Troubleshooting](#troubleshooting)
- [Related docs](#related-docs)
- [Acknowledgements](#acknowledgements)
- [Contributing](#contributing)
- [License](#license)

## Platform support

**iOS and Android only.** This module will not support Expo Web or any browser target — there is no web implementation and none is planned.

| Feature       | iOS | Android |
| ------------- | --- | ------- |
| `Auth.*`      | ✅  | ✅      |
| `AppRemote.*` | ✅  | ✅      |
| `Player.*`    | ✅  | ✅      |
| `User.*`      | ✅  | ✅      |
| `Content.*`   | ✅  | ✅      |
| `Images.*`    | ✅  | ✅      |

## Versioning and Expo SDK lanes

Install the major that matches your Expo SDK:

| npm version | Expo SDK | iOS minimum | Branch                        |
| ----------- | -------- | ----------- | ----------------------------- |
| **`1.x`**   | 55       | 15.1        | `v1` (long-lived maintenance) |
| **`2.x`**   | 56+      | 16.4        | `main`                        |

Both lanes ship the same public API (Auth + App Remote namespaces and hooks). The major version signals **runtime lane**, not a different feature set. See [ADR-0005](./docs/adr/0005-sdk-lane-versioning.md).

The current `main` branch targets **Expo SDK 56** and releases as **`2.x`**. For Expo SDK 55, install **`1.x`** from the `v1` branch ([ADR-0005](./docs/adr/0005-sdk-lane-versioning.md)).

Auth payload note by lane:

- **`2.x` (`main`)**: Android token swap/refresh requests are normalized to match iOS (`code` for swap, `refresh_token` for refresh).
- **`1.x` (`v1`)**: Android keeps the legacy payload shape that includes additional form fields for compatibility with existing backends.

## Public API (Auth + App Remote)

```ts
import {
  Auth,
  AppRemote,
  Player,
  User,
  Content,
  Images,
  SpotifyURI,
  useSession,
  useConnectionState,
  usePlayerState,
  useCurrentTrack,
  useIsPlaying,
  usePlaybackPosition,
  useCapabilities,
  useLibraryState,
} from "@wwdrew/expo-spotify-sdk";
```

Top-level v0-style functions (`authenticateAsync`, `isAvailable`, etc.) are still exported for backward compatibility but are deprecated — see [Migration from v0.x](#migration-from-v0x).

**Not wrapped:** [Spotify Web API](https://developer.spotify.com/documentation/web-api) (`api.spotify.com`). Use the access token from `Auth.authenticate()` and call REST yourself. See [CONTEXT.md](./CONTEXT.md) for terminology.

## Quick start (Expo)

```sh
# 1. Install (Expo SDK 56+ — matches `main` / npm `2.x`)
npx expo install @wwdrew/expo-spotify-sdk

# Expo SDK 55 only: npx expo install @wwdrew/expo-spotify-sdk@1

# 2. Add the config plugin to app.config.ts / app.json  (see Configuration below)
# 3. Regenerate native projects
npx expo prebuild
```

For bare React Native (no Expo CLI), see [Installation in bare React Native](#installation-in-bare-react-native).

## Installation in bare React Native

This library is an [Expo Module](https://docs.expo.dev/modules/overview/) and therefore requires `expo-modules-core` as a peer. If your project does not use the Expo managed workflow you will need to set this up manually.

### 1. Install

```sh
npm install @wwdrew/expo-spotify-sdk expo-modules-core
# or
yarn add @wwdrew/expo-spotify-sdk expo-modules-core
```

### 2. iOS

Add the pod to your `Podfile`:

```ruby
pod 'ExpoSpotifySDK', :path => '../node_modules/@wwdrew/expo-spotify-sdk'
```

Then install pods:

```sh
cd ios && pod install
```

If you have not already bootstrapped `expo-modules-core` in your AppDelegate, follow the [Expo Modules integration guide](https://docs.expo.dev/bare/installing-expo-modules/) first — in particular, your `AppDelegate` must inherit from `ExpoAppDelegate` (or call `ExpoModulesAppDelegateSubscriber`) so that the Spotify redirect URL is handled correctly.

Finally, register your URL scheme. In Xcode open **Info → URL Types** and add a new entry with:

- **Identifier:** `$(PRODUCT_BUNDLE_IDENTIFIER)`
- **URL Schemes:** the value you'll pass as `scheme` in the plugin config (e.g. `myapp`)

### 3. Android

You do **not** need to modify `AndroidManifest.xml`. The module's own manifest (merged by Gradle at build time) already contributes the `<queries>` block for package-visibility and the `<meta-data>` placeholders. The Spotify Auth SDK's AAR brings in its own activities the same way.

The only manual step is in `android/app/build.gradle`. Add the Spotify Auth SDK dependency and populate the manifest placeholders that the module expects:

```groovy
android {
    defaultConfig {
        // ...
        manifestPlaceholders = [
            spotifyClientId:       "your-spotify-client-id",
            spotifyRedirectUri:    "myapp://spotify-auth",
            redirectSchemeName:    "myapp",
            redirectHostName:      "spotify-auth",
            redirectPathPattern:   ".*"
        ]
    }
}

dependencies {
    // ...
    implementation 'com.spotify.android:auth:4.0.1'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0' // required for token swap/refresh
}
```

Replace `myapp`, `spotify-auth`, and `your-spotify-client-id` with your own values. Make sure the redirect URI matches what is registered in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

## Configuration

Add the plugin to your `app.config.ts` (or `app.json`).

### Typed plugin (Expo SDK 56+)

Import from `@wwdrew/expo-spotify-sdk/plugin` for autocomplete and type-checked options:

```ts
import type { ExpoConfig } from "expo/config";
import withSpotifySdk from "@wwdrew/expo-spotify-sdk/plugin";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  plugins: [
    withSpotifySdk({
      clientID: "your-spotify-client-id",
      scheme: "myapp",
      host: "spotify-auth",
    }),
  ],
});
```

### String tuple (all SDK versions)

```ts
export default {
  plugins: [
    [
      "@wwdrew/expo-spotify-sdk",
      {
        clientID: "your-spotify-client-id",
        scheme: "myapp",
        host: "spotify-auth",
      },
    ],
  ],
};
```

`redirectPathPattern` is optional and defaults to `".*"`, which matches every redirect URI shape Spotify will hand back. Only set it if you have a specific path registered in your Spotify app settings:

```ts
{
  clientID: "your-spotify-client-id",
  scheme: "myapp",
  host: "spotify-auth",
  redirectPathPattern: "/auth/.*",
}
```

### Plugin options

| Option                | Type     | Required | Description                                                |
| --------------------- | -------- | -------- | ---------------------------------------------------------- |
| `clientID`            | `string` | ✅       | Your Spotify application's Client ID                       |
| `scheme`              | `string` | ✅       | URL scheme registered for your app (e.g. `"myapp"`)        |
| `host`                | `string` | ✅       | Host component of the redirect URI (e.g. `"spotify-auth"`) |
| `redirectPathPattern` | `string` | —        | Android redirect path regex. Defaults to `".*"`            |

The redirect URI registered in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) must match `{scheme}://{host}` exactly (e.g. `myapp://spotify-auth`).

## Usage

Typical integration: authenticate, connect App Remote, then read/control playback via hooks.

```ts
import { useEffect } from "react";
import {
  Auth,
  AppRemote,
  AuthError,
  AppRemoteError,
  useSession,
  useConnectionState,
  useCurrentTrack,
  useIsPlaying,
} from "@wwdrew/expo-spotify-sdk";

async function login() {
  if (!Auth.isAvailable()) {
    throw new Error("Install the Spotify app to continue");
  }

  // On iOS, clear a leaked in-flight auth before retrying.
  await Auth.cancelPending();

  return Auth.authenticate({
    scopes: ["app-remote-control", "user-read-playback-state", "streaming"],
    tokenSwapURL: "https://your-server.example.com/swap",
    tokenRefreshURL: "https://your-server.example.com/refresh",
  });
}

async function connectRemote(accessToken: string) {
  try {
    await AppRemote.connect(accessToken);
  } catch (e) {
    if (e instanceof AppRemoteError && e.code === "CONNECTION_FAILED") {
      // Spotify's IPC transport is not ready — open Spotify and retry.
      // See "App Remote connection failed" in Troubleshooting.
    }
    throw e;
  }
}

function NowPlaying() {
  const session = useSession();
  const connectionState = useConnectionState();
  const track = useCurrentTrack();
  const isPlaying = useIsPlaying();

  useEffect(() => {
    if (session == null || connectionState !== "disconnected") return;
    void connectRemote(session.accessToken);
  }, [session, connectionState]);

  if (connectionState !== "connected") {
    return null;
  }

  return (
    <Text>
      {track?.name ?? "No track"} · {isPlaying ? "Playing" : "Paused"}
    </Text>
  );
}
```

Omit `tokenSwapURL` / `tokenRefreshURL` to use the implicit TOKEN flow (iOS only for refresh; not recommended on Android — see below). For local development without a swap server, auth can still succeed on iOS; production apps should use the code + swap flow.

### Check account tier (Web API)

App Remote does not expose Premium status. Call Spotify's Web API with the access token from `Auth.authenticate()`:

```ts
const res = await fetch("https://api.spotify.com/v1/me", {
  headers: { Authorization: `Bearer ${session.accessToken}` },
});
const profile = await res.json();
const isPremium = profile.product === "premium";
```

The [example app](./example) displays this as "Account tier: Premium / Free".

### Auto-connect App Remote

Avoid reconnect loops by gating on connection state and attempting at most once per session restore:

```ts
import { useEffect, useRef } from "react";
import {
  AppRemote,
  useConnectionState,
  useSession,
} from "@wwdrew/expo-spotify-sdk";

/**
 * Connect when a session exists and App Remote is disconnected.
 * Set `once` to true to avoid retry spam after failures (recommended on cold start).
 */
export function useAutoConnectAppRemote(options?: { once?: boolean }) {
  const session = useSession();
  const connectionState = useConnectionState();
  const attemptedRef = useRef(false);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token || connectionState !== "disconnected") return;
    if (options?.once && attemptedRef.current) return;

    attemptedRef.current = true;
    void AppRemote.connect(token).catch(() => {
      // Surface via AppRemote.addListener("connectionError") or your UI.
    });
  }, [session?.accessToken, connectionState, options?.once]);
}
```

For iOS, if `connect()` fails with `CONNECTION_FAILED`, foreground the Spotify app and retry manually — see [Troubleshooting](#troubleshooting).

## Spotify Premium and App Remote

| Concern               | Auth (`Auth.*`)         | App Remote (`AppRemote.*`, `Player.*`, …)                                                             |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Spotify app installed | Recommended (native UX) | **Required**                                                                                          |
| Spotify app running   | No                      | **Required** — connect talks to the running Spotify process over IPC                                  |
| Spotify Premium       | No                      | **Required** for reliable on-demand playback and rich player state (track name, transport, browse)    |
| Free account          | Auth works              | `Player.play()` may fail with `PREMIUM_REQUIRED`; `User.getCapabilities().canPlayOnDemand` is `false` |

**This library does not play audio.** It remote-controls the official Spotify app. On Android especially, Free accounts often see empty or incomplete now-playing metadata even when connected.

## Migration from v0.x

v0.x top-level functions remain exported but are deprecated (scheduled for removal in a future major).

| v0.x                           | v1                                                      |
| ------------------------------ | ------------------------------------------------------- |
| `isAvailable()`                | `Auth.isAvailable()`                                    |
| `authenticateAsync(config)`    | `Auth.authenticate(config)`                             |
| `refreshSessionAsync(config)`  | `Auth.refresh(config)`                                  |
| `cancelPendingAuthAsync()`     | `Auth.cancelPending()`                                  |
| `addSessionChangeListener(cb)` | `Auth.addListener("sessionChange", cb)`                 |
| `SpotifyError` (auth throws)   | `AuthError` (or `instanceof SpotifyError` as catch-all) |
| `SpotifyErrorCode`             | `AuthErrorCode`                                         |

`SpotifySession`, `SpotifyScope`, and config shapes are unchanged. For auth-specific `e.code` narrowing, use `instanceof AuthError` instead of `instanceof SpotifyError`.

## API reference

### `Auth`

#### `Auth.isAvailable(): boolean`

Returns `true` if the Spotify app is installed. Does not throw (not available on unsupported platforms).

#### `Auth.authenticate(config): Promise<SpotifySession>`

Starts OAuth via the installed Spotify app (or web fallback). Throws [`AuthError`](#autherror) on failure.

| Field             | Type             | Required | Description                                                                      |
| ----------------- | ---------------- | -------- | -------------------------------------------------------------------------------- |
| `scopes`          | `SpotifyScope[]` | ✅       | At least one scope. Include `app-remote-control` for App Remote.                 |
| `tokenSwapURL`    | `string`         | —        | Code flow + server swap (recommended). Required on Android for a `refreshToken`. |
| `tokenRefreshURL` | `string`         | —        | Refresh endpoint for iOS SDK and `Auth.refresh()`.                               |
| `showDialog`      | `boolean`        | —        | Force the consent screen. Default `false`.                                       |

| Return field     | Type             | Description                                            |
| ---------------- | ---------------- | ------------------------------------------------------ |
| `accessToken`    | `string`         | Bearer token for Web API and `AppRemote.connect()`.    |
| `refreshToken`   | `string \| null` | `null` on Android without `tokenSwapURL`.              |
| `expirationDate` | `number`         | Expiry as Unix epoch **milliseconds**.                 |
| `scopes`         | `SpotifyScope[]` | Granted scopes (requested-only on Android TOKEN flow). |

#### `Auth.cancelPending(): Promise<void>`

Cancels an in-flight `Auth.authenticate()`. On iOS, call before retrying if you see `AUTH_IN_PROGRESS` after a dropped redirect. No-op on Android.

```ts
await Auth.cancelPending();
const session = await Auth.authenticate({ scopes: ["streaming"] });
```

A cancelled call rejects with `AuthError` `code: "USER_CANCELLED"`.

#### `Auth.refresh(config): Promise<SpotifySession>`

Exchanges a refresh token via your refresh server. Pass through `scopes` from the previous session when the refresh response omits `scope`.
`Auth.refresh()` requires a valid `refreshToken` and `tokenRefreshURL`.

```ts
const refreshed = await Auth.refresh({
  refreshToken: previous.refreshToken!,
  tokenRefreshURL: "https://your-server.example.com/refresh",
  scopes: previous.scopes,
});
```

#### `Auth.addListener("sessionChange", listener): Subscription`

Central place to persist tokens. Fires for every `authenticate` / `refresh` — including calls you did not `await`.

| `type`          | Payload                        | When                            |
| --------------- | ------------------------------ | ------------------------------- |
| `"didInitiate"` | `{ session }`                  | `Auth.authenticate()` succeeded |
| `"didRenew"`    | `{ session }`                  | `Auth.refresh()` succeeded      |
| `"didFail"`     | `{ error: { code, message } }` | Either call failed              |

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

| Method                                     | Description                                          |
| ------------------------------------------ | ---------------------------------------------------- |
| `connect(accessToken)`                     | Open IPC to Spotify. Resolves when connected.        |
| `disconnect()`                             | Tear down connection.                                |
| `isConnected()`                            | Synchronous snapshot.                                |
| `getConnectionState()`                     | `"disconnected"` \| `"connecting"` \| `"connected"`. |
| `addListener("connectionStateChange", cb)` | State transitions.                                   |
| `addListener("connectionError", cb)`       | Failures and drops (`AppRemoteError` codes).         |

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

## Error codes by namespace

Every rejection is an instance of a namespace-specific subclass (`AuthError`, `AppRemoteError`, …) extending the abstract `SpotifyError` base. Catch with `instanceof` for typed `code` narrowing.

### `AuthErrorCode`

| Code                     | When                                                       | What to do                                            |
| ------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- |
| `USER_CANCELLED`         | User closed auth or `Auth.cancelPending()` ran             | Benign — no action                                    |
| `AUTH_IN_PROGRESS`       | Concurrent `Auth.authenticate()` or iOS stuck pending auth | `await Auth.cancelPending()` then retry               |
| `INVALID_CONFIG`         | Missing `clientID`, empty `scopes`, or bad plugin setup    | Fix config plugin / `app.config`; run `expo prebuild` |
| `NETWORK_ERROR`          | Device cannot reach `tokenSwapURL` / `tokenRefreshURL`     | Check dev server URL, HTTPS, device network           |
| `TOKEN_SWAP_FAILED`      | Swap server returned non-2xx                               | Fix server; read status + body in `e.message`         |
| `TOKEN_SWAP_PARSE_ERROR` | Swap response was not valid token JSON                     | Fix server response shape                             |
| `SPOTIFY_NOT_INSTALLED`  | Spotify app not found (rare — web fallback may still run)  | Prompt install or use web auth                        |
| `AUTH_ERROR`             | Spotify rejected the authorization                         | Check Dashboard redirect URI, scopes, test users      |
| `UNKNOWN`                | Unexpected native failure                                  | Read `e.message` / `e.cause`; file an issue with logs |

### `AppRemoteErrorCode`

| Code                | When                                                       | What to do                                                  |
| ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `CONNECTION_FAILED` | `connect()` failed (app missing, refused, handshake error) | Open Spotify foreground; re-auth if token stale; retry once |
| `CONNECTION_LOST`   | Connection dropped mid-session                             | `AppRemote.connect()` again with fresh token                |
| `NOT_CONNECTED`     | `AppRemote.*` called before connect completed              | `await AppRemote.connect()` first                           |
| `UNKNOWN`           | Unexpected IPC failure                                     | Read `e.message`; retry connect                             |

### `PlayerErrorCode`

| Code                    | When                                    | What to do                                       |
| ----------------------- | --------------------------------------- | ------------------------------------------------ |
| `NOT_CONNECTED`         | `Player.*` before `AppRemote.connect()` | Connect App Remote first                         |
| `CONNECTION_LOST`       | Dropped during a player call            | Reconnect, then retry                            |
| `PREMIUM_REQUIRED`      | `canPlayOnDemand === false` (Free tier) | Upgrade account or use shuffle/context play only |
| `INVALID_URI`           | URI failed validation                   | Use `SpotifyURI.from()`                          |
| `INVALID_PARAMETER`     | Bad argument (e.g. negative seek)       | Fix caller                                       |
| `OPERATION_NOT_ALLOWED` | Player restriction (can't skip, etc.)   | Check `PlayerState` restrictions                 |
| `UNKNOWN`               | Other native player error               | Read `e.message`                                 |

### `UserErrorCode`

| Code                    | When                               | What to do                                 |
| ----------------------- | ---------------------------------- | ------------------------------------------ |
| `NOT_CONNECTED`         | `User.*` before connect            | Connect App Remote first                   |
| `CONNECTION_LOST`       | Dropped during user API call       | Reconnect                                  |
| `INVALID_URI`           | Bad library URI                    | Use `SpotifyURI.from()`                    |
| `OPERATION_NOT_ALLOWED` | Save/remove blocked (tier, region) | Check `LibraryState.canAdd` / capabilities |
| `UNKNOWN`               | Other native user error            | Read `e.message`                           |

### `ContentErrorCode`

| Code                      | When                                | What to do               |
| ------------------------- | ----------------------------------- | ------------------------ |
| `NOT_CONNECTED`           | `Content.*` before connect          | Connect App Remote first |
| `CONNECTION_LOST`         | Dropped during browse               | Reconnect                |
| `CONTENT_API_UNAVAILABLE` | Spotify app too old for Content API | Update Spotify app       |
| `UNKNOWN`                 | Other content error                 | Read `e.message`         |

### `ImagesErrorCode`

| Code                | When                           | What to do                      |
| ------------------- | ------------------------------ | ------------------------------- |
| `NOT_CONNECTED`     | `Images.load()` before connect | Connect App Remote first        |
| `INVALID_URI`       | Item has no loadable image     | Skip artwork or use placeholder |
| `IMAGE_LOAD_FAILED` | Spotify or disk write failed   | Retry; check free space         |
| `UNKNOWN`           | Other image error              | Read `e.message`                |

## Platform differences (parity)

| Topic                            | iOS                                    | Android                                                                               |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `AppRemote.connect(accessToken)` | Token passed to `SPTAppRemote`         | Token accepted for API parity; SDK uses session cached in Spotify app from prior auth |
| `Auth.cancelPending()`           | Clears stuck `SPTSessionManager` state | No-op                                                                                 |
| Refresh token without swap       | Possible (iOS TOKEN flow)              | Not available — use `tokenSwapURL`                                                    |
| `session.scopes` without swap    | Granted scopes returned                | Requested scopes only (not granted list)                                              |
| Premium / player metadata        | Full App Remote when Premium           | Free accounts often lack track titles / on-demand play                                |
| Content / Images                 | Requires recent Spotify app            | Same                                                                                  |

## Android implicit (TOKEN) flow is not recommended

When `Auth.authenticate()` is called on Android **without** a `tokenSwapURL`, the Spotify Android SDK uses the implicit (TOKEN) flow. This flow has two hard limitations that **will not be fixed** — Spotify has deprecated it:

1. **No `refreshToken`.** The Android SDK does not expose a refresh token for implicit grants. `session.refreshToken` will always be `null`.
2. **`scopes` reflects what was requested, not what was granted.** The Android SDK does not return the actual granted scope list for TOKEN responses.

The library emits a one-time `console.warn` at runtime when this path is taken.

**The fix:** provide a `tokenSwapURL` to use the Authorization Code flow, which returns a full `refreshToken` and the actual granted `scopes` on both platforms.

See [Spotify's migration guide](https://developer.spotify.com/documentation/android/tutorials/migration-token-code) for context, and the [token swap server section](#token-swap-server) below for a reference implementation.

## Token swap server

The `tokenSwapURL` / `tokenRefreshURL` endpoints must be a server you control — **never** put your Spotify `CLIENT_SECRET` in the app bundle.

Think of this server as a small OAuth bridge:

1. The native SDK sends your backend an auth artifact (`code` or `refresh_token`).
2. Your backend exchanges that artifact with Spotify Accounts.
3. Your backend returns Spotify's JSON token payload to the app.

### Server-side values to keep internally

Store these on the server (env/config), not in mobile code:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` (must match the redirect URI registered in Spotify Dashboard and used during auth)

### What the endpoints must do

- Accept `application/x-www-form-urlencoded` requests from the SDK.
- Validate required input (`code` for swap, `refresh_token` for refresh).
- Call Spotify `https://accounts.spotify.com/api/token` with the correct `grant_type`.
- Authenticate to Spotify using your app credentials (typically Basic auth header built from Base64-encoded `client_id:client_secret`).
- Return Spotify's JSON token response to the SDK.

### Swap endpoint (`POST {tokenSwapURL}`)

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

### Refresh endpoint (`POST {tokenRefreshURL}`)

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

## Troubleshooting

**`INVALID_CONFIG: Missing meta-data 'spotifyClientId'`**
Run `expo prebuild` after adding the plugin to your config. The plugin injects the required `AndroidManifest.xml` entries.

**`Auth.isAvailable()` returns `false` on Android 11+ release builds**
Android 11+ requires a `<queries>` element to inspect other apps' package names. The module ships this in its `AndroidManifest.xml`; make sure you are not merging a custom manifest that removes it.

**iOS: authentication never returns**
Ensure your app's URL scheme is registered in Xcode under **Info → URL Types** and that it matches the `scheme` in the plugin config. The `expo prebuild` step does this automatically; if you have a bare workflow, check `CFBundleURLSchemes` in `Info.plist`.

**`AUTH_IN_PROGRESS`**
`Auth.authenticate()` was called while a previous call was still pending. Usually a concurrent call — wait for the first to settle.

On iOS this can also be a stuck state when Spotify never redirects back. Call [`Auth.cancelPending()`](#authcancelpending-promisevoid) before retrying.

**App Remote: `CONNECTION_FAILED` / `Connection refused` (iOS code 61)**
The Spotify app is installed but its App Remote transport is not accepting connections. Common causes:

1. **Spotify is not in the foreground** — switch to Spotify, then retry `AppRemote.connect()`.
2. **Connect ran before auth finished** — call `AppRemote.connect()` only after `Auth.authenticate()` resolves.
3. **Stale access token** — refresh or re-authenticate, then reconnect.
4. **Retry loop on startup** — avoid calling `connect()` on every render while `connectionState === "disconnected"`; gate on a one-shot flag or user action.

**Token swap: `NETWORK_ERROR` / `Could not connect to the server` to `http://127.0.0.1:…/swap`**
The swap URL must be reachable from the device running your app. During local dev, the Expo dev server must be running and serving API routes. Omit `tokenSwapURL` to test auth without a swap server (iOS TOKEN flow only; see [Android implicit flow](#android-implicit-token-flow-is-not-recommended)).

**Now playing shows no track title (Android, Free account)**
App Remote player state is limited for non-Premium users. Check `GET /v1/me` → `product` and `User.getCapabilities().canPlayOnDemand`.

## Related docs

- [CONTEXT.md](./CONTEXT.md) — terminology (Auth SDK vs App Remote vs Web API)
- [docs/V1_PLAN.md](./docs/V1_PLAN.md) — implementation plan and release criteria
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md) — manual QA before a `2.x` release on `main` (or `1.x` on `v1`)
- [docs/RELEASE.md](./docs/RELEASE.md) — Release Please on `main` (`2.x`); maintenance releases from `v1` (`1.x`)
- [ATTRIBUTION.md](./ATTRIBUTION.md) — third-party SDKs and scope boundaries

## Acknowledgements

Inspired by [react-native-spotify-remote](https://github.com/cjam/react-native-spotify-remote) and [expo-spotify](https://github.com/kvbalib/expo-spotify).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
