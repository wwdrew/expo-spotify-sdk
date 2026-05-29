import type { EventSubscription } from "expo-modules-core";

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import { AppRemoteError, type AppRemoteErrorCode } from "./error";

export type { AppRemoteErrorCode } from "./error";
export { AppRemoteError } from "./error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Current state of the IPC connection to the Spotify app. */
export type ConnectionState = "disconnected" | "connecting" | "connected";

/** Payload of the `connectionStateChange` event. */
export interface ConnectionStateChangeEvent {
  state: ConnectionState;
}

/** Payload of the `connectionError` event. */
export interface ConnectionErrorEvent {
  code: AppRemoteErrorCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_APPREMOTE_CODES = new Set<AppRemoteErrorCode>([
  "CONNECTION_FAILED",
  "CONNECTION_LOST",
  "NOT_CONNECTED",
  "UNKNOWN",
]);

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsAppRemoteError(err: unknown): never {
  if (err instanceof AppRemoteError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_APPREMOTE_CODES.has(maybeCode as AppRemoteErrorCode)) {
      throw new AppRemoteError(maybeCode as AppRemoteErrorCode, reason);
    }
    throw new AppRemoteError("UNKNOWN", reason);
  }
  throw new AppRemoteError("UNKNOWN", String(err));
}

// ---------------------------------------------------------------------------
// AppRemote namespace
// ---------------------------------------------------------------------------

/**
 * Spotify App Remote namespace. Manages the IPC connection to the running
 * Spotify app. All `Player`, `User`, `Content`, and `Images` calls require an
 * active connection established via `AppRemote.connect()`.
 *
 * @example
 * ```ts
 * import { AppRemote } from "@wwdrew/expo-spotify-sdk";
 *
 * // Connect using the access token from Auth.authenticate()
 * await AppRemote.connect(session.accessToken);
 *
 * const sub = AppRemote.addListener("connectionStateChange", ({ state }) => {
 *   console.log("connection state:", state);
 * });
 *
 * // later:
 * await AppRemote.disconnect();
 * sub.remove();
 * ```
 */
export const AppRemote = {
  /**
   * Opens a connection to the running Spotify app using the provided access
   * token. Resolves when the connection is established; rejects with an
   * {@link AppRemoteError} if the connection fails.
   *
   * **Android note:** The access token is accepted for API parity with iOS but
   * the Android App Remote SDK does not accept it directly — it uses the
   * session cached in the Spotify app from your earlier `Auth.authenticate()`
   * call. Ensure `Auth.authenticate()` has succeeded before calling `connect()`.
   *
   * Calling `connect()` while already connected is a no-op.
   */
  connect(accessToken: string): Promise<void> {
    return ExpoSpotifySDKModule.appRemoteConnect(accessToken).catch(
      rethrowAsAppRemoteError,
    );
  },

  /**
   * Disconnects from the Spotify app. Safe to call when already disconnected.
   * Resolves once the disconnection is complete.
   */
  disconnect(): Promise<void> {
    return ExpoSpotifySDKModule.appRemoteDisconnect();
  },

  /**
   * Returns `true` if currently connected to the Spotify app.
   * This is a synchronous snapshot — subscribe to `"connectionStateChange"`
   * for reactive updates.
   */
  isConnected(): boolean {
    return ExpoSpotifySDKModule.appRemoteIsConnected();
  },

  /**
   * Returns the current {@link ConnectionState} synchronously.
   * Subscribe to `"connectionStateChange"` for reactive updates.
   */
  getConnectionState(): Promise<ConnectionState> {
    return ExpoSpotifySDKModule.appRemoteGetConnectionState();
  },

  /**
   * Subscribes to connection lifecycle events.
   *
   * | Event | Payload | When |
   * |---|---|---|
   * | `"connectionStateChange"` | `{ state: ConnectionState }` | State transitions |
   * | `"connectionError"` | `{ code, message }` | Connection failures and drops |
   *
   * Returns a `Subscription` — call `.remove()` to unsubscribe.
   */
  addListener<E extends "connectionStateChange" | "connectionError">(
    event: E,
    listener: E extends "connectionStateChange"
      ? (event: ConnectionStateChangeEvent) => void
      : (event: ConnectionErrorEvent) => void,
  ): EventSubscription {
    const nativeEvent =
      event === "connectionStateChange"
        ? "onConnectionStateChange"
        : "onConnectionError";
    return ExpoSpotifySDKModule.addListener(
      nativeEvent,
      listener as (event: unknown) => void,
    ) as EventSubscription;
  },
} as const;
