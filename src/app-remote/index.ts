export type { AppRemoteErrorCode } from "./error";
export { AppRemoteError } from "./error";

// ---------------------------------------------------------------------------
// AppRemote types (stubs — filled in Phase 2)
// ---------------------------------------------------------------------------

/** Current state of the IPC connection to the Spotify app. */
export type ConnectionState = "disconnected" | "connecting" | "connected";

// ---------------------------------------------------------------------------
// AppRemote namespace (stub — implemented in Phase 2)
// ---------------------------------------------------------------------------

/**
 * Spotify App Remote namespace. Manages the IPC connection to the running
 * Spotify app. All `Player`, `User`, `Content`, and `Images` calls require
 * an active connection established via `AppRemote.connect()`.
 *
 * @example
 * ```ts
 * import { AppRemote } from "@wwdrew/expo-spotify-sdk";
 *
 * await AppRemote.connect(session.accessToken);
 * ```
 */
export const AppRemote = {} as const;
