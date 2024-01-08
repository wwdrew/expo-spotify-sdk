/*

List of Scopes:  https://developer.spotify.com/documentation/web-api/concepts/scopes

Note: these scopes are not currently available in the iOS SDK:

- user-read-playback-position
- user-soa-link
- user-soa-unlink
- user-manage-entitlements
- user-manage-partner
- user-create-partner

Also, although these scopes exist in the iOS SDK, they are not valid:

- user-read-birthdate
- openid

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

export interface SpotifyConfig {
  clientID: string;
  host: string;
  scheme: string;
  tokenRefreshURL: string;
  tokenSwapURL: string;
}
