import { ConfigPlugin, withAppBuildGradle } from "@expo/config-plugins";

interface SpotifyConfig {
  host: string;
  scheme: string;
}

const withSpotifyConfigAndroid: ConfigPlugin<SpotifyConfig> = (
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

export const withSpotifyConfig: ConfigPlugin<SpotifyConfig> = (
  config,
  spotifyConfig = {
    host: "host",
    scheme: "scheme",
  },
) => {
  config = withSpotifyConfigAndroid(config, spotifyConfig);

  return config;
};

export default withSpotifyConfig;
