export type { PlayerErrorCode } from "./error";
export { PlayerError } from "./error";

// ---------------------------------------------------------------------------
// Player namespace (stub — implemented in Phase 3)
// ---------------------------------------------------------------------------

/**
 * Spotify Player namespace. Transport controls, queue management, and
 * player-state subscriptions. Requires `AppRemote.connect()` to be resolved
 * before any call.
 *
 * @example
 * ```ts
 * import { Player } from "@wwdrew/expo-spotify-sdk";
 *
 * await Player.play(SpotifyURI.from("spotify:track:4uLU6hMCjMI75M1A2tKUQC"));
 * ```
 */
export const Player = {} as const;
