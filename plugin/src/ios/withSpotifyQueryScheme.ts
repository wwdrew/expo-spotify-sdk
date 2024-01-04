import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

const SPOTIFY_SCHEME = "spotify";

export const withSpotifyQueryScheme: ConfigPlugin<SpotifyConfig> = (config) =>
  withInfoPlist(config, (config) => {
    if (!config.modResults.LSApplicationQueriesSchemes) {
      config.modResults.LSApplicationQueriesSchemes = [];
    }

    if (
      !config.modResults.LSApplicationQueriesSchemes.includes(SPOTIFY_SCHEME)
    ) {
      config.modResults.LSApplicationQueriesSchemes.push(SPOTIFY_SCHEME);
    }

    return config;
  });
