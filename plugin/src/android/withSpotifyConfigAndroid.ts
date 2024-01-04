import {
  AndroidConfig,
  ConfigPlugin,
  withAndroidManifest,
} from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

const formatAndroidKeys = (string: string) => {
  return "Spotify" + string.charAt(0).toUpperCase() + string.slice(1);
};

export const withSpotifyConfigAndroid: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  return withAndroidManifest(config, (config) => {
    Object.entries(spotifyConfig).forEach(([key, value]) => {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults),
        formatAndroidKeys(key),
        String(Array.isArray(value) ? value.join(" ") : value),
      );
    });

    return config;
  });
};
