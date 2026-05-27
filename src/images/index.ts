export type { ImagesErrorCode } from "./error";
export { ImagesError } from "./error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import type { ContentItem } from "../content";
import type { Track } from "../player";
import { ImagesError, ImagesErrorCode } from "./error";

export type ImageSize = "small" | "medium" | "large";

export interface ImageResult {
  uri: string;
}

/** Minimal shape required to fetch an image by identifier. */
interface HasImageIdentifier {
  imageIdentifier?: string | null;
}

/** Minimal album/artist representation for image loading. */
interface BasicImageEntity {
  imageIdentifier?: string | null;
}

export type ImageRepresentable = Track | ContentItem | BasicImageEntity | HasImageIdentifier;

const VALID_IMAGE_CODES = new Set<ImagesErrorCode>([
  "NOT_CONNECTED",
  "INVALID_URI",
  "IMAGE_LOAD_FAILED",
  "UNKNOWN",
]);

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsImagesError(err: unknown): never {
  if (err instanceof ImagesError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_IMAGE_CODES.has(maybeCode as ImagesErrorCode)) {
      throw new ImagesError(maybeCode as ImagesErrorCode, reason);
    }
    throw new ImagesError("UNKNOWN", reason);
  }
  throw new ImagesError("UNKNOWN", String(err));
}

function getImageIdentifier(item: ImageRepresentable): string {
  const value = item?.imageIdentifier;
  if (!value || !value.trim()) {
    throw new ImagesError(
      "INVALID_URI",
      "Images.load(): item does not contain a valid imageIdentifier",
    );
  }
  return value;
}

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
export const Images = {
  /**
   * Loads a Spotify image and returns a local file URI.
   */
  load(item: ImageRepresentable, size: ImageSize): Promise<ImageResult> {
    const imageIdentifier = getImageIdentifier(item);
    return ExpoSpotifySDKModule.imagesLoad(imageIdentifier, size).catch(
      rethrowAsImagesError,
    );
  },
} as const;
