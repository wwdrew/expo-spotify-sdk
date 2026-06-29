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
- [Documentation](#documentation)
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

Top-level v0-style functions were removed in **`2.x`**. If you still use them, stay on **`1.x`** or migrate — see [Migration from v0.x](#migration-from-v0x).

**Not wrapped:** [Spotify Web API](https://developer.spotify.com/documentation/web-api) (`api.spotify.com`). Use the access token from `Auth.authenticate()` and call REST yourself. See [CONTEXT.md](./CONTEXT.md) for terminology.

## Quick start (Expo)

```sh
# 1. Install (Expo SDK 56+ — matches `main` / npm `2.x`)
npx expo install @wwdrew/expo-spotify-sdk

# Expo SDK 55 only: npx expo install @wwdrew/expo-spotify-sdk@1
# (or @sdk55 — npm dist-tag for the v1 maintenance lane)

# 2. Add the config plugin to app.config.ts / app.json  (see Configuration below)
# 3. Regenerate native projects
npx expo prebuild
```

For bare React Native (no Expo CLI), see [Installation in bare React Native](#installation-in-bare-react-native).

## Native SDK binaries

| Platform | Distribution |
| --- | --- |
| **iOS** | `SpotifyiOS` downloaded via CocoaPods HTTP binary pod at `pod install` ([ADR-0009](./docs/adr/0009-ios-spotify-sdk-via-cocoapods-binary-pod.md)). Config plugin injects the Podfile `pod` line on `expo prebuild`. Supported Expo SDK lanes: [Platform support](#platform-support). |
| **Android** | App Remote AAR downloaded from Spotify's GitHub at Gradle build. Auth SDK from Maven Central. |

| You are… | Action |
| --- | --- |
| **Using the published npm package** | Network on first native build per platform (`pod install` / Gradle). |
| **Developing this repo from git** | Same — no manual fetch scripts. |

See [Native SDK distribution](./docs/guides/native-sdk-distribution.md).

## Installation in bare React Native

This library is an [Expo Module](https://docs.expo.dev/modules/overview/) and therefore requires `expo-modules-core` as a peer. If your project does not use the Expo managed workflow you will need to set this up manually.

### 1. Install

```sh
npm install @wwdrew/expo-spotify-sdk expo-modules-core
# or
yarn add @wwdrew/expo-spotify-sdk expo-modules-core
```

### 2. iOS

Add pods to your `Podfile`:

```ruby
pod 'ExpoSpotifySDK', :path => '../node_modules/@wwdrew/expo-spotify-sdk'
pod 'SpotifyiOS', :podspec => File.join(__dir__, '../node_modules/@wwdrew/expo-spotify-sdk/spotify-ios/SpotifyiOS.podspec')
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

### Refreshing the session and handling token expiry

Use `Auth.refresh()` to exchange a stored `refreshToken` for a fresh access token via your `tokenRefreshURL`.

> **Spotify policy (from July 20, 2026):** refresh tokens expire **six months** after they are issued. Once expired, Spotify returns an `invalid_grant` error and the token can no longer be used — the user must sign in again. (Only user tokens are affected; Client Credentials flows are not.)

Handle a failed refresh by **discarding the stored token and re-running `Auth.authenticate()`** — do **not** retry the refresh. When your swap server forwards Spotify's response verbatim (see [Token swap server](./docs/guides/token-swap-server.md)), an expired or revoked refresh token surfaces as `AuthError` with the dedicated code `REFRESH_TOKEN_EXPIRED`:

```ts
async function restoreSession(refreshToken: string) {
  try {
    return await Auth.refresh({
      refreshToken,
      tokenRefreshURL: "https://your-server.example.com/refresh",
    });
  } catch (e) {
    if (e instanceof AuthError && e.code === "REFRESH_TOKEN_EXPIRED") {
      // Token expired or revoked: discard it and send the user through
      // sign-in again. Never retry the refresh.
      await clearStoredSession();
      return login(); // your Auth.authenticate() wrapper
    }
    throw e; // NETWORK_ERROR / TOKEN_SWAP_FAILED etc. — transient; handle/retry as appropriate
  }
}
```

Test this reauthorization path before July 20, 2026 to avoid disruption for existing users.

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

For iOS, if `connect()` fails with `CONNECTION_FAILED`, the Spotify app has likely been suspended in the background — `connect()` can only attach to an already-running Spotify. Instead of asking the user to foreground Spotify and retry manually, call `AppRemote.authorizeAndPlay(accessToken, uri?)`, which wakes Spotify (launching it if needed), starts playback, and then connects:

```ts
try {
  await AppRemote.connect(session.accessToken);
} catch (e) {
  if (e instanceof AppRemoteError && e.code === "CONNECTION_FAILED") {
    // Spotify was suspended — wake it, start playing, and connect.
    await AppRemote.authorizeAndPlay(session.accessToken);
  }
}
```

Note that `authorizeAndPlay()` always starts (or resumes) playback and briefly switches to the Spotify app — see [Troubleshooting](#troubleshooting).

## Spotify Premium and App Remote

| Concern               | Auth (`Auth.*`)         | App Remote (`AppRemote.*`, `Player.*`, …)                                                             |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Spotify app installed | Recommended (native UX) | **Required**                                                                                          |
| Spotify app running   | No                      | **Required** — connect talks to the running Spotify process over IPC                                  |
| Spotify Premium       | No                      | **Required** for reliable on-demand playback and rich player state (track name, transport, browse)    |
| Free account          | Auth works              | `Player.play()` may fail with `PREMIUM_REQUIRED`; `User.getCapabilities().canPlayOnDemand` is `false` |

**This library does not play audio.** It remote-controls the official Spotify app. On Android especially, Free accounts often see empty or incomplete now-playing metadata even when connected.

## Migration from v0.x

**Removed in `2.x`.** The flat top-level functions (`authenticateAsync`, `isAvailable`, `refreshSessionAsync`, `cancelPendingAuthAsync`, `addSessionChangeListener`) and legacy type aliases (`SpotifyConfig`, `SpotifyErrorCode`) are no longer exported on the **`2.x`** lane.

| v0.x | v2 |
| --- | --- |
| `isAvailable()` | `Auth.isAvailable()` |
| `authenticateAsync(config)` | `Auth.authenticate(config)` |
| `refreshSessionAsync(config)` | `Auth.refresh(config)` |
| `cancelPendingAuthAsync()` | `Auth.cancelPending()` |
| `addSessionChangeListener(cb)` | `Auth.addListener("sessionChange", cb)` |
| `SpotifyError` (auth throws) | `AuthError` (or `instanceof SpotifyError` as catch-all) |
| `SpotifyErrorCode` | `AuthErrorCode` |

Need the deprecated shims temporarily? Pin **`1.x`**: `npm install @wwdrew/expo-spotify-sdk@1`.

`SpotifySession`, `SpotifyScope`, and config shapes are unchanged. For auth-specific `e.code` narrowing, use `instanceof AuthError` instead of `instanceof SpotifyError`.

## Documentation

| Guide | Contents |
| --- | --- |
| [API reference](./docs/api-reference.md) | All namespaces, methods, hooks |
| [Error codes](./docs/error-codes.md) | Per-namespace codes with when/what-to-do |
| [Auth error mapping](./docs/auth-error-mapping.md) | iOS/Android auth → JS mapping matrix and parity checklist |
| [App Remote error mapping](./docs/app-remote-error-mapping.md) | iOS/Android native → JS mapping matrix |
| [Platform differences](./docs/guides/platform-differences.md) | iOS vs Android parity |
| [Native SDK distribution](./docs/guides/native-sdk-distribution.md) | How iOS/Android binaries are fetched, packaged, and bumped |
| [Token swap server](./docs/guides/token-swap-server.md) | Swap/refresh endpoints + example app setup |

## Troubleshooting

**`INVALID_CONFIG: Missing meta-data 'spotifyClientId'`**
Run `expo prebuild` after adding the plugin to your config. The plugin injects the required `AndroidManifest.xml` entries.

**`Auth.isAvailable()` returns `false` on Android 11+ release builds**
Android 11+ requires a `<queries>` element to inspect other apps' package names. The module ships this in its `AndroidManifest.xml`; make sure you are not merging a custom manifest that removes it.

**iOS: authentication never returns**
Ensure your app's URL scheme is registered in Xcode under **Info → URL Types** and that it matches the `scheme` in the plugin config. The `expo prebuild` step does this automatically; if you have a bare workflow, check `CFBundleURLSchemes` in `Info.plist`.

**`AUTH_IN_PROGRESS`**
`Auth.authenticate()` was called while a previous call was still pending. Usually a concurrent call — wait for the first to settle.

On iOS this can also be a stuck state when Spotify never redirects back. Call `Auth.cancelPending()` before retrying.

**iOS: errors report `UNKNOWN` with the correct message (Expo SDK ≤ 56)**
On iOS before Expo SDK 57, `expo-modules-core` dropped the structured error `code` when an async function rejected — the message survived but the code did not — so a real code like `USER_CANCELLED` reached JS as `UNKNOWN: Authentication was cancelled by the user`. This is a runtime/bridge limitation, **not** a misclassification: the native module emits the correct code, and the `Auth.addListener("sessionChange", …)` `didFail` event reports it correctly regardless of runtime.

Fixed in **Expo SDK 57** ([expo/expo#47259](https://github.com/expo/expo/pull/47259)). On SDK 57+ `Auth.authenticate()` rejects with the accurate `AuthError.code` and no action is needed.

_Optional — for accurate `code`s on Expo SDK 56 and earlier:_ apply the change from that PR to your installed `expo-modules-core` with [`patch-package`](https://github.com/ds300/patch-package). It routes thrown `Exception`s through the code-preserving conversion in `JavaScriptPromise.reject` instead of stringifying them. If you'd rather not patch, read the code from the `sessionChange` `didFail` event, which already carries the correct `code`.

**App Remote: `CONNECTION_FAILED` / `Connection refused` (iOS code 61)**
The Spotify app is installed but its App Remote transport is not accepting connections. Common causes:

1. **Spotify is suspended / not in the foreground** — `connect()` only attaches to a running Spotify. Call `AppRemote.authorizeAndPlay(accessToken, uri?)` to wake it (it launches Spotify, starts playback, and connects), or have the user switch to Spotify and retry `AppRemote.connect()`.
2. **Connect ran before auth finished** — call `AppRemote.connect()` only after `Auth.authenticate()` resolves.
3. **Stale access token** — refresh or re-authenticate, then reconnect.
4. **Retry loop on startup** — avoid calling `connect()` on every render while `connectionState === "disconnected"`; gate on a one-shot flag or user action.

**Token swap: `NETWORK_ERROR` / `Could not connect to the server` to `http://127.0.0.1:…/swap`**
The swap URL must be reachable from the device running your app. During local dev, the Expo dev server must be running and serving API routes. Omit `tokenSwapURL` to test auth without a swap server (iOS TOKEN flow only; see [Platform differences](./docs/guides/platform-differences.md)).

**Now playing shows no track title (Android, Free account)**
App Remote player state is limited for non-Premium users. Check `GET /v1/me` → `product` and `User.getCapabilities().canPlayOnDemand`.

## Related docs

- [CONTEXT.md](./CONTEXT.md) — terminology (Auth SDK vs App Remote vs Web API)
- [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md) — how native binaries are fetched and packaged
- [docs/api-reference.md](./docs/api-reference.md) — method reference
- [docs/error-codes.md](./docs/error-codes.md) — error code tables
- [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md) — manual QA before a `2.x` release on `main` (or `1.x` on `v1`)
- [docs/RELEASE.md](./docs/RELEASE.md) — Release Please on `main` (`2.x`); maintenance releases from `v1` (`1.x`)
- [ATTRIBUTION.md](./ATTRIBUTION.md) — third-party SDKs and scope boundaries

## Acknowledgements

Inspired by [react-native-spotify-remote](https://github.com/cjam/react-native-spotify-remote) and [expo-spotify](https://github.com/kvbalib/expo-spotify).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
