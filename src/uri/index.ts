/**
 * The six Spotify resource types accepted by App Remote APIs.
 */
export type SpotifyResourceType =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "show"
  | "episode";

/**
 * Branded string type for Spotify URIs (`spotify:<type>:<id>`).
 *
 * Construct via `SpotifyURI.from(str)` (validates) or
 * `SpotifyURI.unsafe(str)` (skips validation — use only when the source is
 * trusted, e.g. a URI that came back from the Spotify SDK itself).
 */
export type SpotifyURI = string & { readonly __brand: "SpotifyURI" };

const URI_RE =
  /^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)$/;

/**
 * Helpers for constructing, validating and decomposing {@link SpotifyURI}
 * values.
 *
 * @example
 * ```ts
 * const uri = SpotifyURI.from("spotify:track:4uLU6hMCjMI75M1A2tKUQC");
 * const { type, id } = SpotifyURI.parse(uri);
 * const rebuilt = SpotifyURI.build("track", id);
 * ```
 */
export const SpotifyURI = {
  /**
   * Cast `uri` to {@link SpotifyURI} after validation.
   * Throws a plain `Error` if the URI does not match the `spotify:<type>:<id>`
   * format — use at app-code call sites where you want early feedback.
   */
  from(uri: string): SpotifyURI {
    if (!SpotifyURI.isValid(uri)) {
      throw new Error(
        `Invalid Spotify URI: "${uri}". Expected spotify:<type>:<id> where ` +
          `<type> is one of: track, album, playlist, artist, show, episode.`,
      );
    }
    return uri as SpotifyURI;
  },

  /**
   * Cast `uri` to {@link SpotifyURI} without validation.
   * Use only for URIs that originate from the Spotify SDK itself (i.e. already
   * known-valid values coming back over the bridge).
   */
  unsafe(uri: string): SpotifyURI {
    return uri as SpotifyURI;
  },

  /**
   * Decompose a {@link SpotifyURI} into its `{ type, id }` parts.
   */
  parse(uri: SpotifyURI): { type: SpotifyResourceType; id: string } {
    const m = uri.match(URI_RE);
    if (!m) {
      throw new Error(`Cannot parse Spotify URI: "${uri}"`);
    }
    return { type: m[1] as SpotifyResourceType, id: m[2] };
  },

  /**
   * Build a {@link SpotifyURI} from a resource type and ID.
   */
  build(type: SpotifyResourceType, id: string): SpotifyURI {
    return `spotify:${type}:${id}` as SpotifyURI;
  },

  /**
   * Type-guard: returns `true` if `uri` is a valid Spotify URI string.
   */
  isValid(uri: string): uri is SpotifyURI {
    return URI_RE.test(uri);
  },
} as const;
