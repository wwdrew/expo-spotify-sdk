# iOS Spotify SDK

`SpotifyiOS.xcframework` is **not** committed to git. It is fetched from Spotify's
GitHub releases before `npm publish` and bundled in the npm tarball
(`scripts/fetch-spotify-sdks.sh`).

Version pin: `ios/spotify-native-sdk-versions.json` (`ios` section).

## Local development

```sh
yarn fetch-native-sdks
cd example/ios && pod install
```

## Bumping the iOS SDK version

Update `version`, `tarballSha256`, and `binarySha256` in
`ios/spotify-native-sdk-versions.json`, then run `yarn fetch-native-sdks`.
