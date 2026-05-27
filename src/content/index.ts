export type { ContentErrorCode } from "./error";
export { ContentError } from "./error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import ExpoSpotifySDKModule from "../ExpoSpotifySDKModule";
import { ContentError, ContentErrorCode } from "./error";

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

const VALID_CONTENT_CODES = new Set<ContentErrorCode>([
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "CONTENT_API_UNAVAILABLE",
  "UNKNOWN",
]);

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

function rethrowAsContentError(err: unknown): never {
  if (err instanceof ContentError) throw err;
  if (err instanceof Error) {
    const reason = unwrapReason(err.message);
    const maybeCode = (err as Error & { code?: string }).code;
    if (maybeCode && VALID_CONTENT_CODES.has(maybeCode as ContentErrorCode)) {
      throw new ContentError(maybeCode as ContentErrorCode, reason);
    }
    throw new ContentError("UNKNOWN", reason);
  }
  throw new ContentError("UNKNOWN", String(err));
}

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
    return ExpoSpotifySDKModule.contentGetChildren(item).catch(rethrowAsContentError);
  },
} as const;
