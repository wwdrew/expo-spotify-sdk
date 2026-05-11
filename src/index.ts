import { EventSubscription, Platform } from "expo-modules-core";

import {
  SpotifyConfig,
  SpotifyError,
  SpotifyErrorCode,
  SpotifyRefreshConfig,
  SpotifySession,
  SpotifySessionChangeEvent,
} from "./ExpoSpotifySDK.types";
import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

const ANDROID_TOKEN_FLOW_WARNING =
  "[expo-spotify-sdk] You are using authenticateAsync on Android without a " +
  "tokenSwapURL. The Spotify Android SDK does NOT return a refresh token or " +
  "the actual granted scopes through this path; see the README's " +
  "'Android implicit (TOKEN) flow is not recommended' section.";

let warnedAboutAndroidTokenFlow = false;

/**
 * Returns `true` if the Spotify app is installed on the device.
 * Always returns `false` on web.
 */
function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

/**
 * Starts a Spotify OAuth flow. Resolves with a {@link SpotifySession};
 * rejects with a {@link SpotifyError} carrying a `code`.
 */
function authenticateAsync(config: SpotifyConfig): Promise<SpotifySession> {
  if (!config.scopes || config.scopes.length === 0) {
    return Promise.reject(
      new SpotifyError(
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
    .catch(rethrowAsSpotifyError);
}

/**
 * Forcibly cancel any in-flight `authenticateAsync` call. Resolves once the
 * native coordinator's pending continuation has been cleared. No-op when
 * nothing is in flight, and a no-op on Android (the Android coordinator
 * self-cleans via structured concurrency).
 *
 * Recovery hatch for the iOS coordinator's stuck-state class of bugs: the
 * SPTSessionManager delegate callbacks are not guaranteed to fire — e.g. when
 * Spotify never redirects back to the host app — leaving the coordinator's
 * `pending` continuation set forever and every subsequent `authenticateAsync`
 * rejecting with `AUTH_IN_PROGRESS` until the process restarts. Call this
 * before `authenticateAsync` to defensively clear any leaked state.
 */
function cancelPendingAuthAsync(): Promise<void> {
  if (Platform.OS !== "ios") {
    return Promise.resolve();
  }
  return ExpoSpotifySDKModule.cancelPendingAuthAsync();
}

function normaliseSession(raw: unknown): SpotifySession {
  if (!raw || typeof raw !== "object") {
    throw new SpotifyError(
      "UNKNOWN",
      "Native module returned a non-object session",
    );
  }
  const r = raw as Record<string, unknown>;
  const accessToken = r.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new SpotifyError("UNKNOWN", "Session is missing accessToken");
  }
  const expirationDate = r.expirationDate;
  if (typeof expirationDate !== "number") {
    throw new SpotifyError("UNKNOWN", "Session is missing expirationDate");
  }
  const refreshTokenRaw = r.refreshToken;
  const refreshToken =
    typeof refreshTokenRaw === "string" && refreshTokenRaw.length > 0
      ? refreshTokenRaw
      : null;
  const scopesRaw = r.scopes;
  const scopes = Array.isArray(scopesRaw)
    ? (scopesRaw.filter(
        (s) => typeof s === "string",
      ) as SpotifySession["scopes"])
    : [];
  return { accessToken, refreshToken, expirationDate, scopes };
}

/**
 * Exchanges a refresh token for a new access token via your token refresh
 * server. Resolves with a fresh {@link SpotifySession}; rejects with a
 * {@link SpotifyError}.
 */
function refreshSessionAsync(
  config: SpotifyRefreshConfig,
): Promise<SpotifySession> {
  if (!config.refreshToken) {
    return Promise.reject(
      new SpotifyError("INVALID_CONFIG", "refreshToken is required"),
    );
  }
  if (!config.tokenRefreshURL) {
    return Promise.reject(
      new SpotifyError("INVALID_CONFIG", "tokenRefreshURL is required"),
    );
  }
  return ExpoSpotifySDKModule.refreshSessionAsync(config)
    .then(normaliseSession)
    .catch(rethrowAsSpotifyError);
}

/**
 * Subscribes to session lifecycle events emitted by the native module.
 *
 * Events are fired for every `authenticateAsync` and `refreshSessionAsync`
 * call, regardless of whether the call was awaited. Useful for persisting
 * tokens in a central store without coupling the store to the call sites.
 *
 * Returns a {@link Subscription} — call `.remove()` to unsubscribe.
 *
 * @example
 * ```ts
 * const sub = addSessionChangeListener((event) => {
 *   if (event.type === "didInitiate" || event.type === "didRenew") {
 *     store.setSession(event.session);
 *   }
 * });
 * // later:
 * sub.remove();
 * ```
 */
function addSessionChangeListener(
  listener: (event: SpotifySessionChangeEvent) => void,
): EventSubscription {
  return ExpoSpotifySDKModule.addListener(
    "onSessionChange",
    listener,
  ) as EventSubscription;
}

const VALID_CODES: ReadonlySet<SpotifyErrorCode> = new Set<SpotifyErrorCode>([
  "USER_CANCELLED",
  "AUTH_IN_PROGRESS",
  "INVALID_CONFIG",
  "NETWORK_ERROR",
  "TOKEN_SWAP_FAILED",
  "TOKEN_SWAP_PARSE_ERROR",
  "SPOTIFY_NOT_INSTALLED",
  "AUTH_ERROR",
  "UNKNOWN",
]);

// expo-modules-core wraps both iOS `Exception`s and Android `CodedException`s
// in a function-call-level decorator that prepends a platform-specific
// prefix (e.g. "Calling the 'authenticateAsync' function has failed" on iOS,
// "Call to function 'ExpoSpotifySDK.authenticateAsync' has been rejected." on
// Android) and joins the original reason with the canonical "→ Caused by: "
// separator. Strip the wrapper so JS consumers see only the native module's
// own reason — `code` is preserved structurally either way.
const CAUSE_SEPARATOR = "→ Caused by: ";

// Legacy fallback for native modules that don't propagate `code` — pre-0.9
// iOS shipped `GenericException("<CODE>: <msg>")`, surfacing as a literal
// "CODE: message" prefix in `err.message` with no structured code.
const LEGACY_CODE_PREFIX_RE = /^([A-Z_][A-Z0-9_]*):\s*(.*)$/s;

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsSpotifyError(err: unknown): never {
  if (err instanceof SpotifyError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_CODES.has(maybeCode as SpotifyErrorCode)) {
      throw new SpotifyError(maybeCode as SpotifyErrorCode, reason);
    }
    const m = reason.match(LEGACY_CODE_PREFIX_RE);
    if (m && VALID_CODES.has(m[1] as SpotifyErrorCode)) {
      throw new SpotifyError(m[1] as SpotifyErrorCode, m[2]);
    }
    throw new SpotifyError("UNKNOWN", reason);
  }
  throw new SpotifyError("UNKNOWN", String(err));
}

const Authenticate = {
  authenticateAsync,
};

export {
  isAvailable,
  authenticateAsync,
  cancelPendingAuthAsync,
  refreshSessionAsync,
  addSessionChangeListener,
  Authenticate,
  SpotifyError,
};
export type {
  SpotifyConfig,
  SpotifyRefreshConfig,
  SpotifySession,
  SpotifySessionChangeEvent,
  SpotifyErrorCode,
  SpotifyScope,
} from "./ExpoSpotifySDK.types";
