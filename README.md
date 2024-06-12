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

**Note for Android:** If not providing a token swap or refresh URL, the Spotify session response access token will expire after 60 minutes and will not include a refresh token. This is due to a limitation in the Android Spotify SDK. It's generally recommended to [implement a token swap endpoint](#token-swap) for this reason.

### Parameters

- `tokenSwapURL` (optional): &lt;string&gt; The URL to use for attempting to swap an authorization code for an access token
- `tokenRefreshURL` (optional): &lt;string&gt; The URL to use for attempting to renew an access token with a refresh token
- `scopes`: An array of OAuth scopes that declare how your app wants to access a user's account. See [Spotify Scopes](https://developer.spotify.com/web-api/using-scopes/) for more information.

**Note:** The following scopes are not available to Expo Spotify SDK:

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
  refreshToken: string | null;
  expirationDate: number;
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

## Token Swap Example

An example token swap endpoint has been provided in the `example` project. For it to work it needs your Spotify client details to be included.

1. Open the `server.js` file and add your client details:

```javascript
const CLIENT_ID = "<your-client-id>";
const CLIENT_SECRET = "<your-client-secret>";
```

These values can be found in your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). You will need an existing Spotify app for this.

2. Run the server

```sh
node server.js
```

3. Set the `tokenSwapURL` value in your `authenticateAsync` call:

```javascript
const session = await authenticateAsync({
  tokenSwapURL: "http://192.168.1.120:3000/swap",
  scopes: [
    ...
  ]
});
```

All authentication requests will now be sent through the token swap server.

## Acknowledgments

This project has been heavily inspired by the following projects:

* [react-native-spotify-remote](https://github.com/cjam/react-native-spotify-remote)
* [expo-spotify](https://github.com/kvbalib/expo-spotify)

## Contribute

Contributions are welcome!

## License

MIT
