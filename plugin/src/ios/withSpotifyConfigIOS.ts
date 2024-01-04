import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

export const withSpotifyConfigIOS: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) =>
  withInfoPlist(config, (config) => {
    if (!config.modResults.ExpoSpotifySDK) {
      config.modResults.ExpoSpotifySDK = {};
    }

    Object.entries(spotifyConfig).forEach(([key, value]) => {
      (config.modResults.ExpoSpotifySDK as { [key: string]: string })[key] =
        value;
    });

    return config;
  });
