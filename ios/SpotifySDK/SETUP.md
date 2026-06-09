# iOS Spotify SDK

`SpotifyiOS.xcframework` is **not** committed to git or bundled in npm.

For **Expo apps** using the config plugin, `expo prebuild` injects a Podfile
`pre_install` hook that runs `ios/fetch-spotify-ios-sdk.sh` before `pod install`
(network required on first iOS native setup).

For **bare React Native** or manual Podfile workflows, add the same hook or run:

```sh
bash node_modules/@wwdrew/expo-spotify-sdk/ios/fetch-spotify-ios-sdk.sh
cd ios && pod install
```

Version pin: `ios/spotify-native-sdk-versions.json` (`ios` section).
