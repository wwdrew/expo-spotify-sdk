# expo-spotify-sdk

[![npm version](https://img.shields.io/npm/v/@wwdrew/expo-spotify-sdk)](https://www.npmjs.com/package/@wwdrew/expo-spotify-sdk)
[![CI](https://img.shields.io/github/actions/workflow/status/wwdrew/expo-spotify-sdk/ci.yml?label=CI)](https://github.com/wwdrew/expo-spotify-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/wwdrew/expo-spotify-sdk)](LICENSE)

An Expo module that wraps the native [Spotify iOS SDK](https://github.com/spotify/ios-sdk) (v5.0.1) and [Spotify Android SDK](https://github.com/spotify/android-sdk) (v4.0.1) to provide OAuth authentication in Expo and React Native apps.

**Why this exists:** Spotify ships native SDKs for iOS and Android that enable authentication via the installed Spotify app (no browser redirect, better UX) but there is no maintained Expo module for them. This library fills that gap.

## Platform support

| Feature                                       | iOS | Android      | Web                 |
| --------------------------------------------- | --- | ------------ | ------------------- |
| `isAvailable()`                               | ✅  | ✅           | ✅ (always `false`) |
| `authenticateAsync` — CODE flow (recommended) | ✅  | ✅           | —                   |
| `authenticateAsync` — TOKEN flow (implicit)   | ✅  | ⚠️ see below | —                   |
| `refreshSessionAsync`                         | ✅  | ✅           | —                   |
| Auth via installed Spotify app                | ✅  | ✅           | —                   |
| Auth via Spotify web fallback                 | ✅  | ✅           | —                   |

## Quick start (Expo)

```sh
# 1. Install
npx expo install @wwdrew/expo-spotify-sdk

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
            redirectPathPattern:   "/.*"
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

Add the plugin to your `app.config.ts` (or `app.json`):

```ts
export default {
  plugins: [
    [
      "@wwdrew/expo-spotify-sdk",
      {
        clientID: "your-spotify-client-id",
        scheme: "myapp",
        host: "spotify-auth",
        // Optional: path pattern accepted by the Spotify Android SDK redirect.
        // Defaults to "/.*" (matches any path). Change this only if you have a
        // specific redirect path registered in your Spotify app settings.
        redirectPathPattern: "/.*",
      },
    ],
  ],
};
```

### Plugin options

| Option                | Type     | Required | Description                                                |
| --------------------- | -------- | -------- | ---------------------------------------------------------- |
| `clientID`            | `string` | ✅       | Your Spotify application's Client ID                       |
| `scheme`              | `string` | ✅       | URL scheme registered for your app (e.g. `"myapp"`)        |
| `host`                | `string` | ✅       | Host component of the redirect URI (e.g. `"spotify-auth"`) |
| `redirectPathPattern` | `string` | —        | Android redirect path regex. Defaults to `"/.*"`           |

The redirect URI registered in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) must match `{scheme}://{host}` exactly (e.g. `myapp://spotify-auth`).

## Usage

```ts
import {
  isAvailable,
  authenticateAsync,
  refreshSessionAsync,
  addSessionChangeListener,
  SpotifyError,
} from "@wwdrew/expo-spotify-sdk";

// Check whether the Spotify app is installed
const spotifyInstalled = isAvailable();

// Authenticate
try {
  const session = await authenticateAsync({
    scopes: ["user-read-email", "streaming"],
    tokenSwapURL: "https://your-server.example.com/swap",
    tokenRefreshURL: "https://your-server.example.com/refresh",
  });

  console.log(session.accessToken); // use with Spotify Web API
  console.log(session.refreshToken); // store securely for later refresh
  console.log(session.expirationDate); // Unix epoch milliseconds
  console.log(session.scopes); // granted scopes
} catch (e) {
  if (e instanceof SpotifyError) {
    if (e.code === "USER_CANCELLED") return; // user backed out — benign
    console.error(`[${e.code}] ${e.message}`);
  }
}
```

### Refresh a session

```ts
import { refreshSessionAsync } from "@wwdrew/expo-spotify-sdk";

const refreshed = await refreshSessionAsync({
  refreshToken: storedRefreshToken,
  tokenRefreshURL: "https://your-server.example.com/refresh",
});
```

## API reference

### `isAvailable(): boolean`

Returns `true` if the Spotify app is installed on the device. Always returns `false` on web. Does not throw.

---

### `authenticateAsync(config: SpotifyConfig): Promise<SpotifySession>`

Starts a Spotify OAuth flow. If the Spotify app is installed it authenticates natively; otherwise it falls back to the Spotify web login page.

**Throws [`SpotifyError`](#spotifyerror)** on failure.

**Parameters (`SpotifyConfig`):**

| Field             | Type             | Required | Description                                                                                                                |
| ----------------- | ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `scopes`          | `SpotifyScope[]` | ✅       | OAuth scopes to request. Must contain at least one entry.                                                                  |
| `tokenSwapURL`    | `string`         | —        | URL of your token swap server endpoint. Triggers CODE flow (recommended). Required on Android to receive a `refreshToken`. |
| `tokenRefreshURL` | `string`         | —        | URL of your token refresh server endpoint. Used by iOS SDK natively and by `refreshSessionAsync` on both platforms.        |

**Returns (`SpotifySession`):**

| Field            | Type             | Description                                                                                                                                         |
| ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`    | `string`         | OAuth access token. Use as `Authorization: Bearer <token>` with the Spotify Web API.                                                                |
| `refreshToken`   | `string \| null` | Refresh token. `null` on Android when no `tokenSwapURL` is provided — see [Android implicit flow](#android-implicit-token-flow-is-not-recommended). |
| `expirationDate` | `number`         | Token expiry as Unix epoch **milliseconds**.                                                                                                        |
| `scopes`         | `SpotifyScope[]` | Granted scopes. On Android TOKEN flow, reflects requested scopes (Spotify does not expose granted scopes in the implicit flow).                     |

---

### `refreshSessionAsync(options): Promise<SpotifySession>`

Exchanges a refresh token for a new access token via your token refresh server.

**Parameters:**

| Field             | Type     | Description                                                 |
| ----------------- | -------- | ----------------------------------------------------------- |
| `refreshToken`    | `string` | The refresh token from a previous `authenticateAsync` call. |
| `tokenRefreshURL` | `string` | URL of your token refresh server endpoint.                  |

**Returns** a fresh `SpotifySession` with an updated `accessToken` and `expirationDate`. If the server rotates the refresh token the new one is returned in `refreshToken`; otherwise the original token is returned so you can continue refreshing.

---

### `addSessionChangeListener(listener): Subscription`

Subscribes to session lifecycle events emitted by the native module. Events fire for every `authenticateAsync` and `refreshSessionAsync` call — including ones you didn't directly `await` — making this the right place to persist tokens in a central store.

Returns a `Subscription` object; call `.remove()` to unsubscribe.

```ts
import { addSessionChangeListener } from "@wwdrew/expo-spotify-sdk";

const sub = addSessionChangeListener((event) => {
  switch (event.type) {
    case "didInitiate":
    case "didRenew":
      store.setSession(event.session); // { accessToken, refreshToken, expirationDate, scopes }
      break;
    case "didFail":
      console.error(`[${event.error.code}] ${event.error.message}`);
      break;
  }
});

// When the subscribing component unmounts:
sub.remove();
```

**Event types (`SpotifySessionChangeEvent`):**

| `type` | Payload | Fired when |
|---|---|---|
| `"didInitiate"` | `{ session: SpotifySession }` | `authenticateAsync` succeeded |
| `"didRenew"` | `{ session: SpotifySession }` | `refreshSessionAsync` succeeded |
| `"didFail"` | `{ error: { code, message } }` | Either function rejected |

---

### `SpotifyError`

All rejections from `authenticateAsync` and `refreshSessionAsync` are instances of `SpotifyError`:

```ts
import { SpotifyError } from "@wwdrew/expo-spotify-sdk";

try {
  await authenticateAsync({ scopes: ["streaming"] });
} catch (e) {
  if (e instanceof SpotifyError) {
    switch (e.code) {
      case "USER_CANCELLED": // user closed the auth screen — benign
      case "AUTH_IN_PROGRESS": // concurrent call — benign
        return;
      case "INVALID_CONFIG": // missing clientID / scopes / tokenSwapURL
      case "NETWORK_ERROR": // connectivity failure during token swap
      case "TOKEN_SWAP_FAILED": // swap server returned non-2xx (e.message has status + body)
      case "TOKEN_SWAP_PARSE_ERROR": // swap server returned invalid JSON
      case "SPOTIFY_NOT_INSTALLED": // Spotify app not found (rare — most flows fall back to web)
      case "AUTH_ERROR": // Spotify returned an error (e.message has detail)
      case "UNKNOWN": // unexpected failure
        reportError(e);
    }
  }
}
```

## Android implicit (TOKEN) flow is not recommended

When `authenticateAsync` is called on Android **without** a `tokenSwapURL`, the Spotify Android SDK uses the implicit (TOKEN) flow. This flow has two hard limitations that **will not be fixed** — Spotify has deprecated it:

1. **No `refreshToken`.** The Android SDK does not expose a refresh token for implicit grants. `session.refreshToken` will always be `null`.
2. **`scopes` reflects what was requested, not what was granted.** The Android SDK does not return the actual granted scope list for TOKEN responses.

The library emits a one-time `console.warn` at runtime when this path is taken.

**The fix:** provide a `tokenSwapURL` to use the Authorization Code flow, which returns a full `refreshToken` and the actual granted `scopes` on both platforms.

See [Spotify's migration guide](https://developer.spotify.com/documentation/android/tutorials/migration-token-code) for context, and the [token swap server section](#token-swap-server) below for a reference implementation.

## Token swap server

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

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app (or use an existing one).
2. In the app settings, under **APIs used**, enable **Web API** (required for the `/v1/me` profile call).
3. Under **Redirect URIs**, add `expo-spotify-sdk-example://authenticate` exactly and save.

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

**`isAvailable()` returns `false` on Android 11+ release builds**
Android 11+ requires a `<queries>` element to inspect other apps' package names. The module ships this in its `AndroidManifest.xml`; make sure you are not merging a custom manifest that removes it.

**iOS: authentication never returns**
Ensure your app's URL scheme is registered in Xcode under **Info → URL Types** and that it matches the `scheme` in the plugin config. The `expo prebuild` step does this automatically; if you have a bare workflow, check `CFBundleURLSchemes` in `Info.plist`.

**`AUTH_IN_PROGRESS`**
`authenticateAsync` was called while a previous call was still pending. Wait for the first call to resolve or reject before calling again.

## Acknowledgements

Inspired by [react-native-spotify-remote](https://github.com/cjam/react-native-spotify-remote) and [expo-spotify](https://github.com/kvbalib/expo-spotify).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
