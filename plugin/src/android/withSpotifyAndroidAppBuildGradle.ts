import { ConfigPlugin, withAppBuildGradle } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

const SENTINEL_KEY = "spotifyClientId";
const DEFAULT_REDIRECT_PATH_PATTERN = ".*";

export const withSpotifyAndroidAppBuildGradle: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents.includes(SENTINEL_KEY)) {
      // Already injected on a previous prebuild; bail to keep this modifier
      // idempotent. Run `expo prebuild --clean` to force a refresh.
      return config;
    }

    const redirectPathPattern =
      spotifyConfig.redirectPathPattern ?? DEFAULT_REDIRECT_PATH_PATTERN;
    const placeholders = `        manifestPlaceholders = [
          spotifyClientId: "${spotifyConfig.clientID}",
          spotifyRedirectUri: "${spotifyConfig.scheme}://${spotifyConfig.host}",
          redirectSchemeName: "${spotifyConfig.scheme}",
          redirectHostName: "${spotifyConfig.host}",
          redirectPathPattern: "${redirectPathPattern}"
        ]`;

    const defaultConfigPattern = /(defaultConfig\s*\{[\s\S]*?)(\n\s*})/m;

    if (defaultConfigPattern.test(config.modResults.contents)) {
      config.modResults.contents = config.modResults.contents.replace(
        defaultConfigPattern,
        `$1\n${placeholders}$2`,
      );
    } else {
      config.modResults.contents += `
android {
    defaultConfig {
${placeholders}
    }
}`;
    }

    return config;
  });
};
