export type { UserErrorCode } from "./error";
export { UserError } from "./error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { EventSubscription } from "expo-modules-core";

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import type { SpotifyURI as SpotifyURIType } from "../uri";
import { UserError, type UserErrorCode } from "./error";

/** Capabilities of the current user in Spotify's App Remote context. */
export interface Capabilities {
  /** `true` for Premium users with on-demand playback capability. */
  canPlayOnDemand: boolean;
}

/** Library save state for a specific album/track URI. */
export interface LibraryState {
  uri: string;
  isAdded: boolean;
  canAdd: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_USER_CODES = new Set<UserErrorCode>([
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "INVALID_URI",
  "OPERATION_NOT_ALLOWED",
  "UNKNOWN",
]);

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsUserError(err: unknown): never {
  if (err instanceof UserError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_USER_CODES.has(maybeCode as UserErrorCode)) {
      throw new UserError(maybeCode as UserErrorCode, reason);
    }
    throw new UserError("UNKNOWN", reason);
  }
  throw new UserError("UNKNOWN", String(err));
}

type LibraryListener = (state: LibraryState) => void;
const libraryListeners = new Map<string, Set<LibraryListener>>();

function notifyLibraryState(state: LibraryState) {
  const set = libraryListeners.get(state.uri);
  if (!set) return;
  set.forEach((listener) => listener(state));
}

/**
 * Spotify User namespace. Capabilities and library-state operations.
 * Requires `AppRemote.connect()` to be resolved before any call.
 */
export const User = {
  /** Returns the current user's capabilities. */
  getCapabilities(): Promise<Capabilities> {
    return ExpoSpotifySDKModule.userGetCapabilities().catch(rethrowAsUserError);
  },

  /** Returns the current library state for a track or album URI. */
  getLibraryState(uri: SpotifyURIType): Promise<LibraryState> {
    return ExpoSpotifySDKModule.userGetLibraryState(uri).catch(rethrowAsUserError);
  },

  /** Adds a track or album URI to the user's library. */
  async addToLibrary(uri: SpotifyURIType): Promise<void> {
    const state = (await ExpoSpotifySDKModule.userAddToLibrary(uri).catch(
      rethrowAsUserError,
    )) as LibraryState;
    notifyLibraryState(state);
  },

  /** Removes a track or album URI from the user's library. */
  async removeFromLibrary(uri: SpotifyURIType): Promise<void> {
    const state = (await ExpoSpotifySDKModule.userRemoveFromLibrary(uri).catch(
      rethrowAsUserError,
    )) as LibraryState;
    notifyLibraryState(state);
  },

  /**
   * Subscribes to user-scoped events.
   * Supported event: `"capabilitiesChange"`.
   */
  addListener(
    event: "capabilitiesChange",
    listener: (event: Capabilities) => void,
  ): EventSubscription {
    return ExpoSpotifySDKModule.addListener(
      "onCapabilitiesChange",
      listener as (event: unknown) => void,
    ) as EventSubscription;
  },

  /**
   * Subscribes to library state changes for a specific URI.
   *
   * There is no native push stream for per-URI library state updates on all
   * platforms, so this listener is updated whenever library mutations are
   * performed via this SDK and can be manually seeded by calling
   * `User.getLibraryState(uri)` before subscribing.
   */
  addLibraryStateListener(
    uri: SpotifyURIType,
    listener: (state: LibraryState) => void,
  ): EventSubscription {
    const key = String(uri);
    let set = libraryListeners.get(key);
    if (!set) {
      set = new Set();
      libraryListeners.set(key, set);
    }
    set.add(listener);
    return {
      remove() {
        const current = libraryListeners.get(key);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) libraryListeners.delete(key);
      },
    } as EventSubscription;
  },
} as const;
