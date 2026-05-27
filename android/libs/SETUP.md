# Android App Remote SDK setup

The Spotify App Remote SDK for Android is not published to Maven Central and must be
downloaded manually.

## Steps

1. Go to <https://github.com/spotify/android-sdk/releases>
2. Download the latest release archive (e.g. `spotify-android-sdk-x.x.x.zip`)
3. Extract `spotify-app-remote-release-x.x.x.aar` from the archive
4. Rename it to `spotify-app-remote-release-0.8.0.aar` (or update the version in
   `android/build.gradle` to match the downloaded version)
5. Place the `.aar` file in this directory (`android/libs/`)

The `flatDir` repository in `android/build.gradle` will pick it up automatically.

## Why not Maven?

The Spotify Auth SDK (`com.spotify.android:auth`) is on Maven Central, but the App Remote
SDK is distributed exclusively via GitHub releases. This directory follows the same pattern
as the iOS side, where `SpotifyiOS.xcframework` is committed directly to `ios/SpotifySDK/`.

## Proguard

`consumer-rules.pro` already keeps the App Remote classes:

```
-keep class com.spotify.android.appremote.** { *; }
```
