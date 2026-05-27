export type { ContentErrorCode } from "./error";
export { ContentError } from "./error";

// ---------------------------------------------------------------------------
// Content namespace (stub — implemented in Phase 5)
// ---------------------------------------------------------------------------

/**
 * Spotify Content namespace. Browse Spotify's curated content tree.
 * Requires `AppRemote.connect()` to be resolved before any call.
 *
 * @example
 * ```ts
 * import { Content } from "@wwdrew/expo-spotify-sdk";
 *
 * const items = await Content.getRecommendedContentItems("default");
 * ```
 */
export const Content = {} as const;
