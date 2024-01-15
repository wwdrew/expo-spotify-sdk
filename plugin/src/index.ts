import { ConfigPlugin } from "@expo/config-plugins";

import { withSpotifyAndroidAppBuildGradle } from "./android/withSpotifyAndroidAppBuildGradle";
import { withSpotifyQueryScheme } from "./ios/withSpotifyQueryScheme";
import { withSpotifyURLScheme } from "./ios/withSpotifyURLScheme";
import { SpotifyConfig } from "./types";
import { withSpotifyConfig } from "./withSpotifyConfig";

export const withSpotifySdkConfig: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) => {
  if (!spotifyConfig.host) {
    throw new Error("Missing required Spotify config value: host");
  }

  if (!spotifyConfig.scheme) {
    throw new Error("Missing required Spotify config value: scheme");
  }

  if (!spotifyConfig.clientID) {
    throw new Error("Missing required Spotify config value: clientID");
  }

  config = withSpotifyConfig(config, spotifyConfig);

  // Android specific
  config = withSpotifyAndroidAppBuildGradle(config, spotifyConfig);

  // iOS specific
  config = withSpotifyQueryScheme(config, spotifyConfig);
  config = withSpotifyURLScheme(config, spotifyConfig);

  return config;
};

export default withSpotifySdkConfig;
