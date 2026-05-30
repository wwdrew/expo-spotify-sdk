import { useSyncExternalStore } from "react";

import { AppRemote, type ConnectionState } from "../app-remote";
import { Auth, type SpotifySession } from "../auth";
import { createSyncExternalStore } from "../internal/sync-external-store";
import { Player, type PlayerState, type Track } from "../player";
import type { SpotifyURI as SpotifyURIType } from "../uri";
import { type Capabilities, type LibraryState, User } from "../user";

type Listener = () => void;

// ---------------------------------------------------------------------------
// Connection-state store
// ---------------------------------------------------------------------------

const connectionStore = createSyncExternalStore<ConnectionState>(
  "disconnected",
  (store) => {
    AppRemote.getConnectionState().then((state) => {
      store.update(state);
    });

    AppRemote.addListener("connectionStateChange", ({ state }) => {
      store.update(state);
    });
  },
);

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

const sessionStore = createSyncExternalStore<SpotifySession | null>(
  null,
  (store) => {
    Auth.addListener("sessionChange", (event) => {
      if (event.type === "didInitiate" || event.type === "didRenew") {
        store.update(event.session);
      } else {
        store.update(null);
      }
    });
  },
);

// ---------------------------------------------------------------------------
// Player-state store
// ---------------------------------------------------------------------------

function normalizePlayerState(
  nextState: PlayerState,
  previousState: PlayerState | null,
): PlayerState {
  const nextName = nextState.track.name?.trim() ?? "";
  const previousName = previousState?.track.name?.trim() ?? "";
  const sameTrack =
    previousState != null && previousState.track.uri === nextState.track.uri;

  // App Remote can occasionally emit a transient blank title between valid
  // snapshots for the same URI; keep the last non-empty title to avoid UI
  // flicker/regression in hooks consumers.
  if (sameTrack && nextName.length === 0 && previousName.length > 0) {
    return {
      ...nextState,
      track: {
        ...nextState.track,
        name: previousState.track.name,
      },
    };
  }

  return nextState;
}

let playerHydrationVersion = 0;

async function hydratePlayerState(
  store: ReturnType<typeof createSyncExternalStore<PlayerState | null>>,
  version: number,
) {
  try {
    const state = await Player.getPlayerState();
    if (version !== playerHydrationVersion) return;
    store.update((previous) => normalizePlayerState(state, previous));
  } catch {
    // Ignore one-shot hydration failures (e.g., connection races). Event stream
    // updates still populate this store once available.
  }
}

const playerStore = createSyncExternalStore<PlayerState | null>(
  null,
  (store) => {
    AppRemote.getConnectionState().then((state) => {
      if (state === "connected") {
        const version = ++playerHydrationVersion;
        hydratePlayerState(store, version).catch(() => {});
      }
    });

    AppRemote.addListener("connectionStateChange", ({ state }) => {
      if (state === "connected") {
        const version = ++playerHydrationVersion;
        hydratePlayerState(store, version).catch(() => {});
        return;
      }

      ++playerHydrationVersion;
      store.update((current) => (current === null ? current : null));
    });

    Player.addListener("playerStateChange", (state) => {
      store.update((previous) => normalizePlayerState(state, previous));
    });
  },
);

// ---------------------------------------------------------------------------
// Capabilities store
// ---------------------------------------------------------------------------

const capabilitiesStore = createSyncExternalStore<Capabilities | null>(
  null,
  (store) => {
    User.getCapabilities()
      .then((capabilities) => {
        store.update(capabilities);
      })
      .catch(() => {
        // Swallow initial read failures (e.g., not connected yet). The event
        // stream will hydrate this later.
      });

    User.addListener("capabilitiesChange", (capabilities) => {
      store.update(capabilities);
    });
  },
);

// ---------------------------------------------------------------------------
// Per-URI library-state store
// ---------------------------------------------------------------------------

interface LibraryStore {
  state: LibraryState | null;
  listeners: Set<Listener>;
  initialised: boolean;
}

const libraryStores = new Map<string, LibraryStore>();

function getOrCreateLibraryStore(uri: SpotifyURIType): LibraryStore {
  const key = String(uri);
  let store = libraryStores.get(key);
  if (!store) {
    store = { state: null, listeners: new Set(), initialised: false };
    libraryStores.set(key, store);
  }
  return store;
}

function initLibraryStore(uri: SpotifyURIType) {
  const store = getOrCreateLibraryStore(uri);
  if (store.initialised) return;
  store.initialised = true;

  User.getLibraryState(uri)
    .then((state) => {
      store.state = state;
      store.listeners.forEach((listener) => listener());
    })
    .catch(() => {
      // Not connected / unavailable yet; listener updates can still arrive later.
    });

  User.addLibraryStateListener(uri, (state) => {
    const next = getOrCreateLibraryStore(uri);
    next.state = state;
    next.listeners.forEach((listener) => listener());
  });
}

function subscribeLibraryState(
  uri: SpotifyURIType,
  listener: Listener,
): () => void {
  const key = String(uri);
  initLibraryStore(uri);
  const store = getOrCreateLibraryStore(uri);
  store.listeners.add(listener);
  return () => {
    const current = libraryStores.get(key);
    if (!current) return;
    current.listeners.delete(listener);
  };
}

function getLibrarySnapshot(uri: SpotifyURIType): LibraryState | null {
  return libraryStores.get(String(uri))?.state ?? null;
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

/**
 * Returns the current Spotify OAuth session, or `null` when not authenticated.
 * Updates automatically whenever `Auth.authenticate()` or `Auth.refresh()`
 * resolves, and on session failure.
 *
 * Built on `useSyncExternalStore` for tearing-free React rendering.
 */
export function useSession(): SpotifySession | null {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getSnapshot,
  );
}

/**
 * Returns the current App Remote {@link ConnectionState}
 * (`"disconnected"` | `"connecting"` | `"connected"`). Updates automatically
 * on every state transition driven by `AppRemote.connect()` and `disconnect()`.
 *
 * Built on `useSyncExternalStore` for tearing-free React rendering.
 *
 * @example
 * ```tsx
 * function ConnectionBanner() {
 *   const state = useConnectionState();
 *   return <Text>{state === "connected" ? "Connected" : "Disconnected"}</Text>;
 * }
 * ```
 */
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(
    connectionStore.subscribe,
    connectionStore.getSnapshot,
    connectionStore.getSnapshot,
  );
}

/**
 * Returns the latest {@link PlayerState} from the Spotify app, or `null`
 * before the first update arrives (i.e., before `AppRemote.connect()` resolves
 * and the native subscription emits its first event).
 *
 * Updates on every state change reported by the Spotify app (track change,
 * pause/resume, seek, shuffle/repeat toggle, etc.).
 *
 * Built on `useSyncExternalStore` for tearing-free React rendering.
 *
 * @example
 * ```tsx
 * function NowPlaying() {
 *   const state = usePlayerState();
 *   if (!state) return <Text>Not playing</Text>;
 *   return <Text>{state.track.name} — {state.isPaused ? "Paused" : "Playing"}</Text>;
 * }
 * ```
 */
export function usePlayerState(): PlayerState | null {
  return useSyncExternalStore(
    playerStore.subscribe,
    playerStore.getSnapshot,
    playerStore.getSnapshot,
  );
}

/**
 * Returns the currently playing {@link Track}, or `null` when nothing is
 * playing or before the first state update arrives.
 *
 * Derived from `usePlayerState`.
 */
export function useCurrentTrack(): Track | null {
  return usePlayerState()?.track ?? null;
}

/**
 * Returns `true` when the Spotify player is actively playing (not paused),
 * and `false` otherwise (including before the first state update arrives).
 *
 * Derived from `usePlayerState`.
 */
export function useIsPlaying(): boolean {
  const state = usePlayerState();
  return state !== null && !state.isPaused;
}

/**
 * Returns the current playback position in milliseconds. Returns `0` before
 * the first state update arrives.
 *
 * **Note:** This value updates whenever the native side emits a player state
 * change (track transitions, pause/resume, seek, etc.) — not on a fixed timer.
 * For a progress bar that ticks smoothly, combine this with a local `Date.now`
 * offset and `requestAnimationFrame`.
 *
 * Derived from `usePlayerState`.
 */
export function usePlaybackPosition(): number {
  return usePlayerState()?.playbackPosition ?? 0;
}

/**
 * Returns the latest Spotify user capabilities, or `null` before the first
 * snapshot arrives.
 *
 * Derived from `User.getCapabilities()` + `User.addListener("capabilitiesChange")`.
 */
export function useCapabilities(): Capabilities | null {
  return useSyncExternalStore(
    capabilitiesStore.subscribe,
    capabilitiesStore.getSnapshot,
    capabilitiesStore.getSnapshot,
  );
}

/**
 * Returns the library state for a specific URI, or `null` before the first
 * snapshot arrives.
 *
 * Derived from `User.getLibraryState(uri)` + `User.addLibraryStateListener(uri, ...)`.
 */
export function useLibraryState(uri: SpotifyURIType): LibraryState | null {
  return useSyncExternalStore(
    (listener) => subscribeLibraryState(uri, listener),
    () => getLibrarySnapshot(uri),
    () => getLibrarySnapshot(uri),
  );
}
