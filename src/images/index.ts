export type { ImagesErrorCode } from "./error";
export { ImagesError } from "./error";

// ---------------------------------------------------------------------------
// Images namespace (stub — implemented in Phase 5)
// ---------------------------------------------------------------------------

/**
 * Spotify Images namespace. Fetches cover art for tracks, albums, artists,
 * and content items via the App Remote SDK, writing the bitmap to a temp file
 * and returning its local URI. Requires `AppRemote.connect()` to be resolved.
 *
 * @example
 * ```ts
 * import { Images } from "@wwdrew/expo-spotify-sdk";
 *
 * const { uri } = await Images.load(track, "large");
 * ```
 */
export const Images = {} as const;
