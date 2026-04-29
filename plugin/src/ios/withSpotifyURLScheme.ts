import { ConfigPlugin, withInfoPlist } from "@expo/config-plugins";

import { SpotifyConfig } from "../types";

export const withSpotifyURLScheme: ConfigPlugin<SpotifyConfig> = (
  config,
  { scheme },
) => {
  return withInfoPlist(config, (config) => {
    const bundleId = config.ios?.bundleIdentifier;
    const urlTypes = config.modResults.CFBundleURLTypes ?? [];

    const alreadyDeclared = urlTypes.some((entry) =>
      entry.CFBundleURLSchemes?.includes(scheme),
    );

    if (!alreadyDeclared) {
      urlTypes.push({
        CFBundleURLName: bundleId ?? "",
        CFBundleURLSchemes: [scheme],
      });
      config.modResults.CFBundleURLTypes = urlTypes;
    }

    return config;
  });
};
