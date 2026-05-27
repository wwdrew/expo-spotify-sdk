import { EventSubscription } from "expo-modules-core";

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import { SpotifyURI } from "../uri";
import { PlayerError, PlayerErrorCode } from "./error";

export type { PlayerErrorCode } from "./error";
export { PlayerError } from "./error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Repeat mode for the Spotify player. */
export type RepeatMode =
  | 0 /** off */
  | 1 /** repeat current track */
  | 2; /** repeat current context */

/** Valid podcast playback speed multipliers. */
export type PodcastPlaybackSpeed = 0.5 | 0.8 | 1.0 | 1.2 | 1.5 | 2.0 | 3.0;

/** A Spotify artist. */
export interface Artist {
  name: string;
  uri: string;
}

/** A Spotify album. */
export interface Album {
  name: string;
  uri: string;
}

/** A track currently loaded in the Spotify player. */
export interface Track {
  uri: string;
  name: string;
  /** Identifier used by `Images.load(...)`. */
  imageIdentifier?: string;
  /** Duration in milliseconds. */
  duration: number;
  artist: Artist;
  album: Album;
  isSaved: boolean;
  isEpisode: boolean;
  isPodcast: boolean;
  isAdvertisement: boolean;
}

/** Current playback options (shuffle / repeat). */
export interface PlaybackOptions {
  isShuffling: boolean;
  /** 0 = off, 1 = repeat track, 2 = repeat context. */
  repeatMode: RepeatMode;
}

/** Actions currently permitted by Spotify (gate UI buttons on these). */
export interface PlaybackRestrictions {
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  canRepeatTrack: boolean;
  canRepeatContext: boolean;
  canToggleShuffle: boolean;
  canSeek: boolean;
}

/** Full snapshot of the Spotify player at a point in time. */
export interface PlayerState {
  track: Track;
  /** Current playback position in milliseconds. */
  playbackPosition: number;
  playbackSpeed: number;
  isPaused: boolean;
  playbackOptions: PlaybackOptions;
  playbackRestrictions: PlaybackRestrictions;
  contextTitle: string;
  contextUri: string;
}

/** Crossfade configuration from the Spotify app. */
export interface CrossfadeState {
  isEnabled: boolean;
  /** Crossfade duration in milliseconds (only meaningful when enabled). */
  duration: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_PLAYER_CODES = new Set<PlayerErrorCode>([
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "PREMIUM_REQUIRED",
  "INVALID_URI",
  "INVALID_PARAMETER",
  "OPERATION_NOT_ALLOWED",
  "UNKNOWN",
]);

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsPlayerError(err: unknown): never {
  if (err instanceof PlayerError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_PLAYER_CODES.has(maybeCode as PlayerErrorCode)) {
      throw new PlayerError(maybeCode as PlayerErrorCode, reason);
    }
    throw new PlayerError("UNKNOWN", reason);
  }
  throw new PlayerError("UNKNOWN", String(err));
}

// ---------------------------------------------------------------------------
// Player namespace
// ---------------------------------------------------------------------------

/**
 * Spotify Player namespace. Transport controls, queue management, and
 * player-state subscriptions. Requires `AppRemote.connect()` to be resolved
 * before any call.
 *
 * @example
 * ```ts
 * import { Player, SpotifyURI } from "@wwdrew/expo-spotify-sdk";
 *
 * await Player.play(SpotifyURI.from("spotify:track:4uLU6hMCjMI75M1A2tKUQC"));
 * const state = await Player.getPlayerState();
 *
 * const sub = Player.addListener("playerStateChange", (state) => {
 *   console.log("now playing:", state.track.name, "paused:", state.isPaused);
 * });
 * ```
 */
export const Player = {
  /**
   * Asks Spotify to play the entity identified by the given URI.
   * Requires Spotify Premium for on-demand track playback; throws
   * `PlayerError("PREMIUM_REQUIRED", ...)` for Free users.
   */
  play(uri: SpotifyURI): Promise<void> {
    return ExpoSpotifySDKModule.playerPlay(uri).catch(rethrowAsPlayerError);
  },

  /** Pauses playback. */
  pause(): Promise<void> {
    return ExpoSpotifySDKModule.playerPause().catch(rethrowAsPlayerError);
  },

  /** Resumes paused playback. */
  resume(): Promise<void> {
    return ExpoSpotifySDKModule.playerResume().catch(rethrowAsPlayerError);
  },

  /** Skips to the next track in the queue or context. */
  skipNext(): Promise<void> {
    return ExpoSpotifySDKModule.playerSkipNext().catch(rethrowAsPlayerError);
  },

  /** Skips to the previous track. */
  skipPrevious(): Promise<void> {
    return ExpoSpotifySDKModule.playerSkipPrevious().catch(rethrowAsPlayerError);
  },

  /**
   * Seeks to the given position in milliseconds.
   * Only valid when `PlaybackRestrictions.canSeek` is `true`.
   */
  seekTo(positionMs: number): Promise<void> {
    return ExpoSpotifySDKModule.playerSeekTo(positionMs).catch(rethrowAsPlayerError);
  },

  /** Enables or disables shuffle. */
  setShuffle(enabled: boolean): Promise<void> {
    return ExpoSpotifySDKModule.playerSetShuffle(enabled).catch(rethrowAsPlayerError);
  },

  /**
   * Sets the repeat mode.
   * @param mode 0 = off, 1 = repeat track, 2 = repeat context.
   */
  setRepeatMode(mode: RepeatMode): Promise<void> {
    return ExpoSpotifySDKModule.playerSetRepeatMode(mode).catch(rethrowAsPlayerError);
  },

  /**
   * Sets the podcast playback speed. Only takes effect when a podcast episode
   * is playing; valid speeds are `0.5 | 0.8 | 1.0 | 1.2 | 1.5 | 2.0 | 3.0`.
   */
  setPodcastPlaybackSpeed(speed: PodcastPlaybackSpeed): Promise<void> {
    return ExpoSpotifySDKModule.playerSetPodcastPlaybackSpeed(speed).catch(
      rethrowAsPlayerError,
    );
  },

  /** Adds a track URI to the end of the current playback queue. */
  queue(uri: SpotifyURI): Promise<void> {
    return ExpoSpotifySDKModule.playerQueue(uri).catch(rethrowAsPlayerError);
  },

  /** Returns the current {@link PlayerState} as a one-shot pull. */
  getPlayerState(): Promise<PlayerState> {
    return ExpoSpotifySDKModule.playerGetPlayerState().catch(rethrowAsPlayerError);
  },

  /** Returns the current {@link CrossfadeState} as a one-shot pull. */
  getCrossfadeState(): Promise<CrossfadeState> {
    return ExpoSpotifySDKModule.playerGetCrossfadeState().catch(rethrowAsPlayerError);
  },

  /**
   * Subscribes to player state changes. The callback fires whenever the
   * Spotify app reports a state update (track change, pause/resume, seek,
   * shuffle/repeat change, etc.).
   *
   * Returns a `Subscription` — call `.remove()` to unsubscribe.
   *
   * @example
   * ```ts
   * const sub = Player.addListener("playerStateChange", (state) => {
   *   console.log("track:", state.track.name, "paused:", state.isPaused);
   * });
   * // ...later:
   * sub.remove();
   * ```
   */
  addListener(
    event: "playerStateChange",
    listener: (state: PlayerState) => void,
  ): EventSubscription {
    return ExpoSpotifySDKModule.addListener(
      "onPlayerStateChange",
      listener as (event: unknown) => void,
    ) as EventSubscription;
  },
} as const;
