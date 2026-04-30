/**
 * Spotify scopes that are valid in Spotify's iOS, Android and Web auth APIs.
 *
 * See: https://developer.spotify.com/documentation/web-api/concepts/scopes
 */
export type SpotifyScopes =
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

/**
 * Configuration accepted by the `@wwdrew/expo-spotify-sdk` Expo config plugin.
 *
 * @example
 * // app.config.ts
 * export default {
 *   plugins: [
 *     ["@wwdrew/expo-spotify-sdk", {
 *       clientID: "<spotify-client-id>",
 *       scheme: "myapp",
 *       host: "spotify-auth",
 *       redirectPathPattern: ".*"
 *     }]
 *   ]
 * }
 */
export interface SpotifyConfig {
  /** Spotify Client ID for your application. */
  clientID: string;
  /** Path component of the redirect URI (e.g. `"spotify-auth"`). */
  host: string;
  /**
   * URL scheme registered for your app, used as the redirect URI scheme
   * (e.g. `"myapp"`). Must match your Expo app's `scheme`.
   */
  scheme: string;
  /**
   * Path pattern Spotify will accept on the redirect URI. Required by the
   * Spotify Android Auth SDK from version 3.0.0 onwards. Defaults to `".*"`
   * which matches any path including the empty string, so it works for both
   * `scheme://host` and `scheme://host/path` redirect URIs. Use a more
   * specific pattern (e.g. `"/auth/.*"`) only if you have a specific path
   * registered in your Spotify app settings.
   *
   * See: https://developer.android.com/guide/topics/manifest/data-element#path
   */
  redirectPathPattern?: string;
}
