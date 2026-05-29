import { useSyncExternalStore } from "react";

import { AppRemote, type ConnectionState } from "../app-remote";
import { Auth, type SpotifySession } from "../auth";
import { Player, type PlayerState, type Track } from "../player";
import { type Capabilities, type LibraryState, User } from "../user";
import type { SpotifyURI as SpotifyURIType } from "../uri";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Connection-state store
//
// A module-level singleton that caches the latest ConnectionState, exposes a
// subscribe function for useSyncExternalStore, and stays in sync via the
// native onConnectionStateChange event. Initialised lazily on first use.
// ---------------------------------------------------------------------------

let _connectionState: ConnectionState = "disconnected";
const _connectionListeners = new Set<Listener>();
let _connectionStoreInitialised = false;

function initConnectionStore() {
  if (_connectionStoreInitialised) return;
  _connectionStoreInitialised = true;

  // Seed with the current native state so the first snapshot is accurate.
  AppRemote.getConnectionState().then((state) => {
    if (state !== _connectionState) {
      _connectionState = state;
      _connectionListeners.forEach((l) => l());
    }
  });

  AppRemote.addListener("connectionStateChange", ({ state }) => {
    _connectionState = state;
    _connectionListeners.forEach((l) => l());
  });
}

function subscribeConnectionState(listener: Listener): () => void {
  initConnectionStore();
  _connectionListeners.add(listener);
  return () => _connectionListeners.delete(listener);
}

function getConnectionSnapshot(): ConnectionState {
  return _connectionState;
}

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

let _session: SpotifySession | null = null;
const _sessionListeners = new Set<Listener>();
let _sessionStoreInitialised = false;

function initSessionStore() {
  if (_sessionStoreInitialised) return;
  _sessionStoreInitialised = true;

  Auth.addListener("sessionChange", (event) => {
    if (event.type === "didInitiate" || event.type === "didRenew") {
      _session = event.session;
    } else {
      _session = null;
    }
    _sessionListeners.forEach((l) => l());
  });
}

function subscribeSession(listener: Listener): () => void {
  initSessionStore();
  _sessionListeners.add(listener);
  return () => _sessionListeners.delete(listener);
}

function getSessionSnapshot(): SpotifySession | null {
  return _session;
}

// ---------------------------------------------------------------------------
// Player-state store
//
// Seeded from the first playerStateChange event after subscription. The
// native side automatically starts streaming player state updates once the
// App Remote connection is established.
// ---------------------------------------------------------------------------

let _playerState: PlayerState | null = null;
const _playerListeners = new Set<Listener>();
let _playerStoreInitialised = false;

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

function notifyPlayerListeners() {
  _playerListeners.forEach((l) => l());
}

async function hydratePlayerState() {
  try {
    const state = await Player.getPlayerState();
    _playerState = normalizePlayerState(state, _playerState);
    notifyPlayerListeners();
  } catch {
    // Ignore one-shot hydration failures (e.g., connection races). Event stream
    // updates still populate this store once available.
  }
}

function initPlayerStore() {
  if (_playerStoreInitialised) return;
  _playerStoreInitialised = true;

  // Hydrate immediately if the module is already connected before any consumer
  // subscribes to player events.
  AppRemote.getConnectionState().then((state) => {
    if (state === "connected") {
      void hydratePlayerState();
    }
  });

  // Refresh the one-shot snapshot whenever App Remote reconnects, and clear on
  // disconnect so stale "now playing" data is not retained.
  AppRemote.addListener("connectionStateChange", ({ state }) => {
    if (state === "connected") {
      void hydratePlayerState();
      return;
    }

    if (_playerState !== null) {
      _playerState = null;
      notifyPlayerListeners();
    }
  });

  Player.addListener("playerStateChange", (state) => {
    _playerState = normalizePlayerState(state, _playerState);
    notifyPlayerListeners();
  });
}

function subscribePlayerState(listener: Listener): () => void {
  initPlayerStore();
  _playerListeners.add(listener);
  return () => _playerListeners.delete(listener);
}

function getPlayerSnapshot(): PlayerState | null {
  return _playerState;
}

// ---------------------------------------------------------------------------
// Capabilities store
// ---------------------------------------------------------------------------

let _capabilities: Capabilities | null = null;
const _capabilitiesListeners = new Set<Listener>();
let _capabilitiesStoreInitialised = false;

function initCapabilitiesStore() {
  if (_capabilitiesStoreInitialised) return;
  _capabilitiesStoreInitialised = true;

  User.getCapabilities()
    .then((capabilities) => {
      _capabilities = capabilities;
      _capabilitiesListeners.forEach((l) => l());
    })
    .catch(() => {
      // Swallow initial read failures (e.g., not connected yet). The event
      // stream will hydrate this later.
    });

  User.addListener("capabilitiesChange", (capabilities) => {
    _capabilities = capabilities;
    _capabilitiesListeners.forEach((l) => l());
  });
}

function subscribeCapabilities(listener: Listener): () => void {
  initCapabilitiesStore();
  _capabilitiesListeners.add(listener);
  return () => _capabilitiesListeners.delete(listener);
}

function getCapabilitiesSnapshot(): Capabilities | null {
  return _capabilities;
}

// ---------------------------------------------------------------------------
// Per-URI library-state store
// ---------------------------------------------------------------------------

interface LibraryStore {
  state: LibraryState | null;
  listeners: Set<Listener>;
  initialised: boolean;
}

const _libraryStores = new Map<string, LibraryStore>();

function getOrCreateLibraryStore(uri: SpotifyURIType): LibraryStore {
  const key = String(uri);
  let store = _libraryStores.get(key);
  if (!store) {
    store = { state: null, listeners: new Set(), initialised: false };
    _libraryStores.set(key, store);
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
      store.listeners.forEach((l) => l());
    })
    .catch(() => {
      // Not connected / unavailable yet; listener updates can still arrive later.
    });

  User.addLibraryStateListener(uri, (state) => {
    const next = getOrCreateLibraryStore(uri);
    next.state = state;
    next.listeners.forEach((l) => l());
  });
}

function subscribeLibraryState(uri: SpotifyURIType, listener: Listener): () => void {
  const key = String(uri);
  initLibraryStore(uri);
  const store = getOrCreateLibraryStore(uri);
  store.listeners.add(listener);
  return () => {
    const current = _libraryStores.get(key);
    if (!current) return;
    current.listeners.delete(listener);
  };
}

function getLibrarySnapshot(uri: SpotifyURIType): LibraryState | null {
  return _libraryStores.get(String(uri))?.state ?? null;
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
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
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
    subscribeConnectionState,
    getConnectionSnapshot,
    getConnectionSnapshot,
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
  return useSyncExternalStore(subscribePlayerState, getPlayerSnapshot, getPlayerSnapshot);
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
    subscribeCapabilities,
    getCapabilitiesSnapshot,
    getCapabilitiesSnapshot,
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
