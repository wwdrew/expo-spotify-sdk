import { ConfigPlugin } from "@expo/config-plugins";

import { withSpotifyAndroidAppBuildGradle } from "./android/withSpotifyAndroidAppBuildGradle";
import { withSpotifyQueryScheme } from "./ios/withSpotifyQueryScheme";
import { SpotifyConfig } from "./types";
import { withSpotifyConfig } from "./withSpotifyConfig";

export const withSpotifySdkConfig: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig = {
    host: "host",
    scheme: "scheme",
  },
) => {
  config = withSpotifyConfig(config, spotifyConfig);

  // Android specific
  config = withSpotifyAndroidAppBuildGradle(config, spotifyConfig);

  // iOS specific
  config = withSpotifyQueryScheme(config, spotifyConfig);

  return config;
};

export default withSpotifySdkConfig;
