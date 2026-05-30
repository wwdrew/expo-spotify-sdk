// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import { ContentError, type ContentErrorCode } from "./error";
import { createNativeErrorRethrow } from "../internal/native-errors";

export type { ContentErrorCode } from "./error";
export { ContentError } from "./error";

export type ContentType = "default" | "navigation" | "fitness" | "gaming";

export interface ContentItem {
  title: string | null;
  subtitle: string | null;
  contentDescription: string | null;
  identifier: string;
  uri: string;
  imageIdentifier: string | null;
  isAvailableOffline: boolean;
  isPlayable: boolean;
  isContainer: boolean;
  isPinned: boolean;
  children?: ContentItem[];
}

const rethrowAsContentError = createNativeErrorRethrow({
  ErrorClass: ContentError,
  unknownCode: "UNKNOWN",
  validCodes: new Set<ContentErrorCode>([
    "NOT_CONNECTED",
    "CONNECTION_LOST",
    "CONTENT_API_UNAVAILABLE",
    "UNKNOWN",
  ]),
});

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
export const Content = {
  /**
   * Returns Spotify-curated recommended content for the given feed type.
   */
  getRecommendedContentItems(type: ContentType): Promise<ContentItem[]> {
    return ExpoSpotifySDKModule.contentGetRecommendedContentItems(type).catch(
      rethrowAsContentError,
    );
  },

  /**
   * Returns children of a browsable (container) content item.
   */
  getChildren(item: ContentItem): Promise<ContentItem[]> {
    return ExpoSpotifySDKModule.contentGetChildren(item).catch(
      rethrowAsContentError,
    );
  },
} as const;
