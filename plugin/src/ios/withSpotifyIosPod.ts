import { ConfigPlugin, withPodfile } from "@expo/config-plugins";
import { mergeContents } from "@expo/config-plugins/build/utils/generateCode";

export const PODFILE_SPOTIFY_IOS_TAG = "expo-spotify-sdk-spotify-ios-pod";

/**
 * Standard CocoaPods binary pod — SpotifyiOS.podspec uses `source: { http: ... }`
 * so CocoaPods downloads and runs `prepare_command` (unlike `:path` pods).
 */
export const PODFILE_SPOTIFY_IOS_POD = `  pod 'SpotifyiOS', :podspec => File.join(__dir__, '../node_modules/@wwdrew/expo-spotify-sdk/spotify-ios/SpotifyiOS.podspec')`;

export function applySpotifyIosPod(podfileContents: string): string {
  const merged = mergeContents({
    tag: PODFILE_SPOTIFY_IOS_TAG,
    src: podfileContents,
    newSrc: PODFILE_SPOTIFY_IOS_POD,
    anchor: /use_expo_modules!/,
    offset: 1,
    comment: "#",
  });

  return merged.didMerge || merged.didClear
    ? merged.contents
    : podfileContents;
}

export const withSpotifyIosPod: ConfigPlugin = (config) => {
  return withPodfile(config, (config) => {
    config.modResults.contents = applySpotifyIosPod(
      config.modResults.contents,
    );
    return config;
  });
};
