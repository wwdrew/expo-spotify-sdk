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
