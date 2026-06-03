// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import type { ContentItem } from "../content";
import { createNativeErrorRethrow } from "../internal/native-errors";
import type { Track } from "../player";
import { ImagesError, type ImagesErrorCode } from "./error";

export type { ImagesErrorCode } from "./error";
export { ImagesError } from "./error";

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

export type ImageRepresentable =
  | Track
  | ContentItem
  | BasicImageEntity
  | HasImageIdentifier;

const rethrowAsImagesError = createNativeErrorRethrow({
  ErrorClass: ImagesError,
  unknownCode: "UNKNOWN",
  validCodes: new Set<ImagesErrorCode>([
    "NOT_CONNECTED",
    "INVALID_URI",
    "IMAGE_LOAD_FAILED",
    "UNKNOWN",
  ]),
});

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
