import { useSyncExternalStore } from "react";

import { AppRemote, ConnectionState } from "../app-remote";
import { SpotifySession } from "../auth";
import { Auth } from "../auth";

// ---------------------------------------------------------------------------
// Connection-state store
//
// A module-level singleton that caches the latest ConnectionState, exposes a
// subscribe function for useSyncExternalStore, and stays in sync via the
// native onConnectionStateChange event. Initialised lazily on first use.
// ---------------------------------------------------------------------------

type Listener = () => void;

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
