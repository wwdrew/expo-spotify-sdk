import { Platform } from "react-native";

import {
  SpotifyConfig,
  SpotifyError,
  SpotifyErrorCode,
  SpotifySession,
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

const ERROR_PREFIX_RE = /^([A-Z_][A-Z0-9_]*):\s*(.*)$/s;

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

function rethrowAsSpotifyError(err: unknown): never {
  if (err instanceof SpotifyError) throw err;
  if (err instanceof Error) {
    const m = err.message.match(ERROR_PREFIX_RE);
    if (m && VALID_CODES.has(m[1] as SpotifyErrorCode)) {
      throw new SpotifyError(m[1] as SpotifyErrorCode, m[2]);
    }
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_CODES.has(maybeCode as SpotifyErrorCode)) {
      throw new SpotifyError(maybeCode as SpotifyErrorCode, err.message);
    }
    throw new SpotifyError("UNKNOWN", err.message);
  }
  throw new SpotifyError("UNKNOWN", String(err));
}

const Authenticate = {
  authenticateAsync,
};

export { isAvailable, authenticateAsync, Authenticate, SpotifyError };
export type {
  SpotifyConfig,
  SpotifySession,
  SpotifyErrorCode,
  SpotifyScope,
} from "./ExpoSpotifySDK.types";
