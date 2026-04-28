/**
 * Result of a successful Spotify authentication.
 *
 * The shape is identical across iOS and Android. On the Android implicit
 * (TOKEN) flow `refreshToken` is `null` and `scopes` reflects what was
 * *requested*, not granted — see the README's "Android implicit flow is not
 * recommended" section.
 */
export interface SpotifySession {
  /** OAuth access token. */
  accessToken: string;
  /**
   * OAuth refresh token. `null` on Android when no `tokenSwapURL` is provided
   * (the Spotify Android SDK does not expose a refresh token for implicit
   * grants — see the README).
   */
  refreshToken: string | null;
  /** Expiration timestamp as Unix epoch milliseconds. */
  expirationDate: number;
  /** Scopes the access token was granted (or requested, on Android implicit). */
  scopes: SpotifyScope[];
}

/**
 * Configuration accepted by `refreshSessionAsync`.
 */
export interface SpotifyRefreshConfig {
  /** The refresh token from a previous `authenticateAsync` call. */
  refreshToken: string;
  /** URL of your token refresh server endpoint. */
  tokenRefreshURL: string;
}

/**
 * Configuration accepted by `authenticateAsync`.
 */
export interface SpotifyConfig {
  /** OAuth scopes to request. Must contain at least one entry. */
  scopes: SpotifyScope[];
  /**
   * If supplied, requests an authorization code rather than an implicit
   * token, then POSTs the code to this URL to exchange it for tokens.
   * **Required on Android** to receive a usable `refreshToken`.
   */
  tokenSwapURL?: string;
  /**
   * Used by the iOS SDK to refresh access tokens automatically, and by
   * `refreshSessionAsync` on both platforms.
   */
  tokenRefreshURL?: string;
}

/**
 * Spotify OAuth scope identifiers that are valid through the iOS, Android
 * and Web auth flows. See https://developer.spotify.com/documentation/web-api/concepts/scopes
 */
export type SpotifyScope =
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
 * JS-side error code constants thrown via `Promise.reject(new Error(...))`
 * by the native modules.
 */
export type SpotifyErrorCode =
  | "USER_CANCELLED"
  | "AUTH_IN_PROGRESS"
  | "INVALID_CONFIG"
  | "NETWORK_ERROR"
  | "TOKEN_SWAP_FAILED"
  | "TOKEN_SWAP_PARSE_ERROR"
  | "SPOTIFY_NOT_INSTALLED"
  | "AUTH_ERROR"
  | "UNKNOWN";

/**
 * Payload delivered to `addSessionChangeListener` subscribers.
 *
 * - `didInitiate` — a new session was created by `authenticateAsync`
 * - `didRenew`    — an existing session was refreshed by `refreshSessionAsync`
 * - `didFail`     — an auth or refresh attempt failed
 */
export type SpotifySessionChangeEvent =
  | { type: "didInitiate"; session: SpotifySession }
  | { type: "didRenew"; session: SpotifySession }
  | { type: "didFail"; error: { code: SpotifyErrorCode; message: string } };

/**
 * Error subclass thrown by `authenticateAsync` and `refreshSessionAsync`
 * carrying a structured `code` field for branching.
 */
export class SpotifyError extends Error {
  public readonly code: SpotifyErrorCode;

  constructor(code: SpotifyErrorCode, message: string) {
    super(message);
    this.name = "SpotifyError";
    this.code = code;
  }
}
