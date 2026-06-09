import { ConfigPlugin } from "@expo/config-plugins";

import { withSpotifyAndroidAppBuildGradle } from "./android/withSpotifyAndroidAppBuildGradle";
import { withSpotifyConfigValues } from "./ios/withSpotifyConfigValues";
import { withSpotifyIosPod } from "./ios/withSpotifyIosPod";
import { withSpotifyQueryScheme } from "./ios/withSpotifyQueryScheme";
import { withSpotifyURLScheme } from "./ios/withSpotifyURLScheme";
import { SpotifyConfig } from "./types";

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

  // Android specific
  config = withSpotifyAndroidAppBuildGradle(config, spotifyConfig);

  // iOS specific
  config = withSpotifyIosPod(config);
  config = withSpotifyConfigValues(config, spotifyConfig);
  config = withSpotifyQueryScheme(config, spotifyConfig);
  config = withSpotifyURLScheme(config, spotifyConfig);

  return config;
};

export default withSpotifySdkConfig;
