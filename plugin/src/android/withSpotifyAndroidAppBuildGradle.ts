import { ConfigPlugin, withAppBuildGradle } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

export const withSpotifyAndroidAppBuildGradle: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  return withAppBuildGradle(config, (config) => {
    const defaultConfigPattern = /(defaultConfig\s*{[\s\S]*?)(})/s;
    const manifestPlaceholders = `
        buildConfigField "String", "SPOTIFY_CLIENT_ID", "\\"${spotifyConfig.clientID}\\""
        buildConfigField "String", "SPOTIFY_REDIRECT_URI", "\\"${spotifyConfig.scheme}://${spotifyConfig.host}\\""

        manifestPlaceholders = [redirectSchemeName: "${spotifyConfig.scheme}", redirectHostName: "${spotifyConfig.host}"]
    `;

    if (defaultConfigPattern.test(config.modResults.contents)) {
      // If the defaultConfig block exists, add the manifestPlaceholders to it
      config.modResults.contents = config.modResults.contents.replace(
        defaultConfigPattern,
        `$1${manifestPlaceholders}$2`,
      );
    } else {
      // If the defaultConfig block doesn't exist, add it to the android block
      config.modResults.contents += `
android {
    defaultConfig {
        ${manifestPlaceholders}
    }
}`;
    }

    return config;
  });
};
