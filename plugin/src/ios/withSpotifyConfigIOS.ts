import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

interface SpotifySDKConfig {
  [key: string]: string;
}

export const withSpotifyConfigIOS: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) =>
  withInfoPlist(config, (config) => {
    if (!config.modResults.ExpoSpotifySDK) {
      config.modResults.ExpoSpotifySDK = {};
    }

    const spotifySDKConfig = config.modResults
      .ExpoSpotifySDK as SpotifySDKConfig;

    Object.entries(spotifyConfig).forEach(([key, value]) => {
      spotifySDKConfig[key] = value;
    });

    return config;
  });
