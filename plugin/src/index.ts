import { SpotifyConfig } from "./types";

const PACKAGE_NAME = "@wwdrew/expo-spotify-sdk";

/**
 * Typed config plugin helper for `app.config.ts` (Expo SDK 56+).
 *
 * @example
 * import withSpotifySdk from "@wwdrew/expo-spotify-sdk/plugin";
 *
 * export default ({ config }) => ({
 *   ...config,
 *   plugins: [
 *     withSpotifySdk({
 *       clientID: "your-spotify-client-id",
 *       scheme: "myapp",
 *       host: "spotify-auth",
 *     }),
 *   ],
 * });
 */
export default (props: SpotifyConfig): [string, SpotifyConfig] => [
  PACKAGE_NAME,
  props,
];

export type { SpotifyConfig, SpotifyScopes } from "./types";
