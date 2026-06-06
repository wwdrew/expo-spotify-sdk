# Android App Remote SDK

The Spotify App Remote SDK for Android is **not** on Maven Central. This module
downloads `spotify-app-remote-release-<version>.aar` from Spotify's GitHub
releases at Gradle build time (`android/spotify-native-sdk.gradle`).

Version pin: `ios/spotify-native-sdk-versions.json` (`android` section).

The downloaded `.aar` is gitignored under `android/libs/`.

## Bumping the App Remote version

Update `appRemoteVersion`, `appRemoteReleaseTag`, and `appRemoteSha256` in
`ios/spotify-native-sdk-versions.json`, then ship a new release of this package.
