type StoreListener = () => void;

export interface SyncExternalStore<T> {
  subscribe: (listener: StoreListener) => () => void;
  getSnapshot: () => T;
  getState: () => T;
  update: (next: T | ((prev: T) => T)) => void;
}

/**
 * Module-level store backing `useSyncExternalStore` hooks. Initialises lazily on
 * first subscription and notifies subscribers when `update` changes the snapshot.
 */
export function createSyncExternalStore<T>(
  initialState: T,
  init: (store: SyncExternalStore<T>) => void,
): SyncExternalStore<T> {
  let state = initialState;
  const listeners = new Set<StoreListener>();
  let initialised = false;

  const store: SyncExternalStore<T> = {
    getState: () => state,
    getSnapshot: () => state,
    update(next) {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      if (Object.is(resolved, state)) return;
      state = resolved;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      if (!initialised) {
        initialised = true;
        try {
          init(store);
        } catch (error) {
          initialised = false;
          throw error;
        }
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return store;
}
