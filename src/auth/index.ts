import type { EventSubscription } from "expo-modules-core";
import { Platform } from "expo-modules-core";

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import { AuthError, type AuthErrorCode } from "./error";
import { createNativeErrorRethrow } from "../internal/native-errors";

export type { AuthErrorCode } from "./error";
export { AuthError } from "./error";

// ---------------------------------------------------------------------------
// Auth-specific types
// ---------------------------------------------------------------------------

export interface SpotifySession {
  /** OAuth access token. */
  accessToken: string;
  /**
   * OAuth refresh token. `null` on Android when no `tokenSwapURL` is provided
   * (the Spotify Android SDK does not expose a refresh token for implicit
   * grants).
   */
  refreshToken: string | null;
  /** Expiration timestamp as Unix epoch milliseconds. */
  expirationDate: number;
  /** Scopes the access token was granted (or requested, on Android implicit). */
  scopes: SpotifyScope[];
}

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

export interface AuthenticateConfig {
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
   * `Auth.refresh()` on both platforms.
   */
  tokenRefreshURL?: string;
  /**
   * If `true`, forces Spotify to show the authorization dialog even when the
   * user already has an active session. Defaults to `false`.
   */
  showDialog?: boolean;
}

export interface RefreshConfig {
  /** The refresh token from a previous `Auth.authenticate()` call. */
  refreshToken: string;
  /** URL of your token refresh server endpoint. */
  tokenRefreshURL: string;
  /**
   * Scopes that were granted by the previous session. Used as a fallback when
   * the refresh response omits the `scope` field.
   */
  scopes?: SpotifyScope[];
}

/**
 * Payload delivered to `Auth.addListener("sessionChange", ...)` subscribers.
 */
export type SessionChangeEvent =
  | { type: "didInitiate"; session: SpotifySession }
  | { type: "didRenew"; session: SpotifySession }
  | { type: "didFail"; error: { code: AuthErrorCode; message: string } };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ANDROID_TOKEN_FLOW_WARNING =
  "[expo-spotify-sdk] You are using Auth.authenticate on Android without a " +
  "tokenSwapURL. The Spotify Android SDK does NOT return a refresh token or " +
  "the actual granted scopes through this path; see the README's " +
  "'Android implicit (TOKEN) flow is not recommended' section.";

let warnedAboutAndroidTokenFlow = false;

const rethrowAsAuthError = createNativeErrorRethrow({
  ErrorClass: AuthError,
  unknownCode: "UNKNOWN",
  validCodes: new Set<AuthErrorCode>([
    "USER_CANCELLED",
    "AUTH_IN_PROGRESS",
    "INVALID_CONFIG",
    "NETWORK_ERROR",
    "TOKEN_SWAP_FAILED",
    "TOKEN_SWAP_PARSE_ERROR",
    "REFRESH_TOKEN_EXPIRED",
    "SPOTIFY_NOT_INSTALLED",
    "AUTH_ERROR",
    "UNKNOWN",
  ]),
});

function normaliseSession(raw: unknown): SpotifySession {
  if (!raw || typeof raw !== "object") {
    throw new AuthError(
      "UNKNOWN",
      "Native module returned a non-object session",
    );
  }
  const r = raw as Record<string, unknown>;
  const accessToken = r.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new AuthError("UNKNOWN", "Session is missing accessToken");
  }
  const expirationDate = r.expirationDate;
  if (typeof expirationDate !== "number") {
    throw new AuthError("UNKNOWN", "Session is missing expirationDate");
  }
  const refreshTokenRaw = r.refreshToken;
  const refreshToken =
    typeof refreshTokenRaw === "string" && refreshTokenRaw.length > 0
      ? refreshTokenRaw
      : null;
  const scopesRaw = r.scopes;
  const scopes = Array.isArray(scopesRaw)
    ? (scopesRaw.filter((s) => typeof s === "string") as SpotifyScope[])
    : [];
  return { accessToken, refreshToken, expirationDate, scopes };
}

// ---------------------------------------------------------------------------
// Auth namespace
// ---------------------------------------------------------------------------

/**
 * Spotify Auth namespace. Handles OAuth authentication and session lifecycle.
 *
 * @example
 * ```ts
 * import { Auth } from "@wwdrew/expo-spotify-sdk";
 *
 * const session = await Auth.authenticate({ scopes: ["streaming"] });
 * ```
 */
export const Auth = {
  /**
   * Returns whether Spotify sign-in can proceed on this device.
   *
   * - **Android:** `true` when the Spotify app is installed **or** a browser can
   *   open Spotify's web auth flow (needed when the app is not installed).
   * - **iOS:** `true` when the Spotify app is installed (web auth uses the
   *   system authentication session and does not require a separate check).
   */
  isAvailable(): boolean {
    return ExpoSpotifySDKModule.isAvailable();
  },

  /**
   * Starts a Spotify OAuth flow. Resolves with a {@link SpotifySession};
   * rejects with an {@link AuthError} carrying a `code`.
   */
  authenticate(config: AuthenticateConfig): Promise<SpotifySession> {
    if (!config.scopes || config.scopes.length === 0) {
      return Promise.reject(
        new AuthError(
          "INVALID_CONFIG",
          "scopes must contain at least one entry",
        ),
      );
    }
    if (
      Platform.OS === "android" &&
      !config.tokenSwapURL &&
      !warnedAboutAndroidTokenFlow
    ) {
      warnedAboutAndroidTokenFlow = true;
      console.warn(ANDROID_TOKEN_FLOW_WARNING);
    }
    return ExpoSpotifySDKModule.authenticateAsync(config)
      .then(normaliseSession)
      .catch(rethrowAsAuthError);
  },

  /**
   * Exchanges a refresh token for a new access token via your token refresh
   * server. Resolves with a fresh {@link SpotifySession}; rejects with an
   * {@link AuthError}.
   */
  refresh(config: RefreshConfig): Promise<SpotifySession> {
    if (!config.refreshToken) {
      return Promise.reject(
        new AuthError("INVALID_CONFIG", "refreshToken is required"),
      );
    }
    if (!config.tokenRefreshURL) {
      return Promise.reject(
        new AuthError("INVALID_CONFIG", "tokenRefreshURL is required"),
      );
    }
    return ExpoSpotifySDKModule.refreshSessionAsync(config)
      .then(normaliseSession)
      .catch(rethrowAsAuthError);
  },

  /**
   * Forcibly cancel any in-flight `Auth.authenticate()` call. No-op on
   * Android (the Android coordinator self-cleans via structured concurrency).
   *
   * Use before `Auth.authenticate()` to defensively clear any leaked iOS
   * coordinator state (the `SPTSessionManager` delegate callbacks are not
   * guaranteed to fire).
   */
  cancelPending(): Promise<void> {
    if (Platform.OS !== "ios") {
      return Promise.resolve();
    }
    return ExpoSpotifySDKModule.cancelPendingAuthAsync();
  },

  /**
   * Subscribes to session lifecycle events.
   *
   * Events fire for every `Auth.authenticate()` and `Auth.refresh()` call,
   * regardless of whether the call was awaited. Useful for persisting tokens
   * in a central store without coupling the store to the call sites.
   *
   * Returns a `Subscription` — call `.remove()` to unsubscribe.
   *
   * @example
   * ```ts
   * const sub = Auth.addListener("sessionChange", (event) => {
   *   if (event.type === "didInitiate" || event.type === "didRenew") {
   *     store.setSession(event.session);
   *   }
   * });
   * // later:
   * sub.remove();
   * ```
   */
  addListener(
    event: "sessionChange",
    listener: (event: SessionChangeEvent) => void,
  ): EventSubscription {
    return ExpoSpotifySDKModule.addListener(
      "onSessionChange",
      listener,
    ) as EventSubscription;
  },
} as const;
