// ---------------------------------------------------------------------------
// Hooks (v1 public API)
// ---------------------------------------------------------------------------

export {
  useSession,
  useConnectionState,
  usePlayerState,
  useCurrentTrack,
  useIsPlaying,
  usePlaybackPosition,
  useCapabilities,
  useLibraryState,
} from "./hooks";

// ---------------------------------------------------------------------------
// Namespaces (v1 public API)
// ---------------------------------------------------------------------------

export { Auth } from "./auth";
export { AppRemote } from "./app-remote";
export { Player } from "./player";
export { User } from "./user";
export { Content } from "./content";
export { Images } from "./images";

// ---------------------------------------------------------------------------
// Error hierarchy
// ---------------------------------------------------------------------------

export { SpotifyError } from "./error";
export { AuthError } from "./auth";
export { AppRemoteError } from "./app-remote";
export { PlayerError } from "./player";
export { UserError } from "./user";
export { ContentError } from "./content";
export { ImagesError } from "./images";

// ---------------------------------------------------------------------------
// Error code types
// ---------------------------------------------------------------------------

export type { AuthErrorCode } from "./auth";
export type { AppRemoteErrorCode } from "./app-remote";
export type { PlayerErrorCode } from "./player";
export type { UserErrorCode } from "./user";
export type { ContentErrorCode } from "./content";
export type { ImagesErrorCode } from "./images";

// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------

export { SpotifyURI } from "./uri";
export type { SpotifyResourceType, SpotifyURI as SpotifyURIType } from "./uri";

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export type {
  SpotifySession,
  SpotifyScope,
  AuthenticateConfig,
  RefreshConfig,
  SessionChangeEvent,
} from "./auth";

// ---------------------------------------------------------------------------
// App Remote types
// ---------------------------------------------------------------------------

export type {
  ConnectionState,
  ConnectionStateChangeEvent,
  ConnectionErrorEvent,
} from "./app-remote";

// ---------------------------------------------------------------------------
// Player types
// ---------------------------------------------------------------------------

export type {
  RepeatMode,
  PodcastPlaybackSpeed,
  Artist,
  Album,
  Track,
  PlaybackOptions,
  PlaybackRestrictions,
  PlayerState,
  CrossfadeState,
} from "./player";

// ---------------------------------------------------------------------------
// User types
// ---------------------------------------------------------------------------

export type { Capabilities, LibraryState } from "./user";

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

export type { ContentType, ContentItem } from "./content";

// ---------------------------------------------------------------------------
// Images types
// ---------------------------------------------------------------------------

export type { ImageSize, ImageResult, ImageRepresentable } from "./images";

// ---------------------------------------------------------------------------
// v0.x backward-compatible exports (deprecated — remove at v2.0.0)
//
// These shims let existing callers continue to compile after upgrading to v1.
// Migrate to the namespaced API: see docs/V1_PLAN.md §8 (Migration).
// ---------------------------------------------------------------------------

import { Auth } from "./auth";
import type {
  AuthenticateConfig as SpotifyConfig,
  RefreshConfig as SpotifyRefreshConfig,
} from "./auth";

/** @deprecated Use `Auth.isAvailable()` */
export function isAvailable(): boolean {
  return Auth.isAvailable();
}

/** @deprecated Use `Auth.authenticate(config)` */
export function authenticateAsync(config: SpotifyConfig) {
  return Auth.authenticate(config);
}

/** @deprecated Use `Auth.cancelPending()` */
export function cancelPendingAuthAsync() {
  return Auth.cancelPending();
}

/** @deprecated Use `Auth.refresh(config)` */
export function refreshSessionAsync(config: SpotifyRefreshConfig) {
  return Auth.refresh(config);
}

/** @deprecated Use `Auth.addListener("sessionChange", cb)` */
export function addSessionChangeListener(
  listener: Parameters<typeof Auth.addListener>[1],
) {
  return Auth.addListener("sessionChange", listener);
}

// Re-export legacy type aliases so existing `import type { SpotifyConfig }`
// consumers don't break.
export type { SpotifyConfig, SpotifyRefreshConfig };

/**
 * @deprecated `SpotifyErrorCode` is now `AuthErrorCode`. Import via:
 * `import type { AuthErrorCode } from "@wwdrew/expo-spotify-sdk"`
 */
export type { AuthErrorCode as SpotifyErrorCode } from "./auth";
