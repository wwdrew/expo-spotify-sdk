import { ConfigPlugin } from "@expo/config-plugins";

import { withSpotifyConfigAndroid } from "./android/withSpotifyConfigAndroid";
import { withSpotifyConfigIOS } from "./ios/withSpotifyConfigIOS";
import { SpotifyConfig } from "./types";

export const withSpotifyConfig: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  config = withSpotifyConfigAndroid(config, spotifyConfig);
  config = withSpotifyConfigIOS(config, spotifyConfig);

  return config;
};
