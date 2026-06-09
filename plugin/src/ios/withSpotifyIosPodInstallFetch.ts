import { ConfigPlugin, withPodfile } from "@expo/config-plugins";
import { mergeContents } from "@expo/config-plugins/build/utils/generateCode";

export const PODFILE_FETCH_TAG = "expo-spotify-sdk-ios-fetch";

/**
 * Ruby injected into the app Podfile. Runs before CocoaPods integrates path-based
 * pods (Expo autolinking). `prepare_command` in the podspec does not run for
 * `:path` pods, so this hook is required for fetch-at-pod-install.
 */
export const PODFILE_PRE_INSTALL_RUBY = `pre_install do |installer|
  fetch_script = \`node --print "require('path').join(require.resolve('@wwdrew/expo-spotify-sdk/package.json'), 'ios', 'fetch-spotify-ios-sdk.sh')"\`.strip
  unless system('bash', fetch_script)
    raise 'ExpoSpotifySDK: failed to fetch SpotifyiOS.xcframework (see node_modules/@wwdrew/expo-spotify-sdk/ios/SpotifySDK/SETUP.md)'
  end
end`;

export function applySpotifyIosPodInstallFetch(podfileContents: string): string {
  const merged = mergeContents({
    tag: PODFILE_FETCH_TAG,
    src: podfileContents,
    newSrc: PODFILE_PRE_INSTALL_RUBY,
    anchor: /^platform :ios\b/m,
    offset: 1,
    comment: "#",
  });

  return merged.didMerge || merged.didClear
    ? merged.contents
    : podfileContents;
}

export const withSpotifyIosPodInstallFetch: ConfigPlugin = (config) => {
  return withPodfile(config, (config) => {
    config.modResults.contents = applySpotifyIosPodInstallFetch(
      config.modResults.contents,
    );
    return config;
  });
};
