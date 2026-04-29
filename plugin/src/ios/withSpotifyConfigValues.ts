import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

const IOS_KEYS: ReadonlyArray<keyof SpotifyConfig> = [
  "clientID",
  "host",
  "scheme",
];

export const withSpotifyConfigValues: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig,
) =>
  withInfoPlist(config, (config) => {
    const existing = (config.modResults.ExpoSpotifySDK ?? {}) as Record<
      string,
      string
    >;
    for (const key of IOS_KEYS) {
      const value = spotifyConfig[key];
      if (typeof value === "string" && value.length > 0) {
        existing[key] = value;
      }
    }
    config.modResults.ExpoSpotifySDK = existing;
    return config;
  });
