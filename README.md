# expo-spotify-sdk

An Expo Module for the native [iOS](https://github.com/spotify/ios-sdk/) and [Android](https://github.com/spotify/android-sdk/) Spotify SDK

## Supported Features

- Authentication (currently iOS only, Android coming soon)

More to come...

## Installation

```sh
npx expo install @wwdrew/expo-spotify-sdk
```

## Configuration

Include the `expo-spotify-sdk` plugin in your `app.json/app.config.js` file with its required configuration:

```javascript
  ...
  "plugins": [
    ["@wwdrew/expo-spotify-sdk", {
      "clientID": "<your-spotify-client-id>",
      "scheme": "expo-spotify-sdk-example",
      "host": "authenticate"
    }]
  ],
  ...
```

Required:

- `clientID`: &lt;string&gt; the Spotify Client ID for your application
- `scheme`: &lt;string&gt; the [URL scheme](https://docs.expo.dev/versions/latest/config/app/#scheme) to link into your app as part of the redirect URI
- `host`: &lt;string&gt; the path of the redirect URI

## API Reference

```typescript
isAvailable(): boolean`
```

Determines if the Spotify app is installed on the target device.

---

```typescript
authenticateAsync(config: SpotifyConfig): Promise<SpotifySession>
```

Starts the authentication process. Requires an array of OAuth scopes. If the Spotify app is installed on the target device it will interact directly with it, otherwise it will open a web view to authenticate with the Spotify website.

### Parameters

- `tokenSwapURL` (optional): &lt;string&gt; The URL to use for attempting to swap an authorization code for an access token
- `tokenRefreshURL` (optional): &lt;string&gt; The URL to use for attempting to renew an access token with a refresh token
- `scopes`: An array of OAuth scopes that declare how your app wants to access a user's account. See [Spotify Scopes](https://developer.spotify.com/web-api/using-scopes/) for more information.

  **Note**: The following scopes are not available to Expo Spotify SDK:

  - user-read-playback-position
  - user-soa-link
  - user-soa-unlink
  - user-manage-entitlements
  - user-manage-partner
  - user-create-partner

### Types

```typescript
interface SpotifyConfig {
  scopes: SpotifyScope[];
  tokenSwapURL?: string;
  tokenRefreshURL?: string;
}

interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expirationDate: number;
  isExpired: boolean;
  scopes: SpotifyScopes[];
}

type SpotifyScopes =
  | "ugc-image-upload"
  | "user-read-playback-state"
  | "user-modify-playback-state"
  | "user-read-currently-playing"
  | "app-remote-control"
  | "streaming"
  | "playlist-read-private"
  | "playlist-read-collaborative"
  | "playlist-modify-private"
  | "playlist-modify-public"
  | "user-follow-modify"
  | "user-follow-read"
  | "user-top-read"
  | "user-read-recently-played"
  | "user-library-modify"
  | "user-library-read"
  | "user-read-email"
  | "user-read-private";
```

## Acknowledgments

This project has been heavily inspired by the following projects:

* [react-native-spotify-remote](https://github.com/cjam/react-native-spotify-remote)
* [expo-spotify](https://github.com/kvbalib/expo-spotify)

## Contribute

Contributions are welcome!

## License

MIT
