import { ConfigPlugin, withAppBuildGradle } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

export const withSpotifyAndroidAppBuildGradle: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents += `
android {
    defaultConfig {
        manifestPlaceholders = [redirectSchemeName: "${spotifyConfig.scheme}", redirectHostName: "${spotifyConfig.host}"]
    }
}`;

    return config;
  });
};
