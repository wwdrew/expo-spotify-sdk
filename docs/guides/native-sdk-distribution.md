# Native SDK distribution

How Spotify's iOS and Android SDK binaries reach consumers of `@wwdrew/expo-spotify-sdk`.

See [ADR-0009](../adr/0009-ios-spotify-sdk-via-cocoapods-binary-pod.md) (iOS) and [ADR-0001](../adr/0001-build-time-download-of-spotify-native-sdks.md) (Android). ADR-0009 supersedes the iOS portion of [ADR-0008](../adr/0008-ios-spotify-sdk-via-spm.md).

## Summary

| Audience | What happens |
| --- | --- |
| **npm consumers** | `npm install` — no Spotify binaries in the tarball. Native SDKs resolved at build time. |
| **npm consumers (iOS)** | `pod install` downloads `SpotifyiOS` via CocoaPods HTTP binary pod (`spotify-ios/SpotifyiOS.podspec`). Network required on first iOS native build. |
| **npm consumers (Android)** | Gradle `preBuild` downloads App Remote AAR from Spotify's GitHub. Network required on first Android native build. |
| **git contributors** | Same as npm consumers — no manual fetch scripts. |
| **release CI** | `prepublishOnly` runs `yarn build`, `yarn build:plugin`, and `scripts/verify-npm-pack.sh`. |

## What is bundled / resolved

| Platform | Artifact | How it arrives |
| --- | --- | --- |
| iOS | `SpotifyiOS.xcframework` | Config plugin adds `pod 'SpotifyiOS', :podspec => ...` → HTTP download at `pod install` → [spotify/ios-sdk](https://github.com/spotify/ios-sdk) |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | Gradle download at build → [spotify/android-sdk releases](https://github.com/spotify/android-sdk/releases) |
| Android (Auth) | `com.spotify.android:auth` | Maven Central (version in `android/build.gradle`) |

Version pins: [`ios/spotify-native-sdk-versions.json`](../ios/spotify-native-sdk-versions.json) (`ios` and `android` sections).

**Zero** Spotify native binaries in the npm tarball.

## npm packaging

`package.json` `files` includes:

- `ios/spotify-native-sdk-versions.json`
- `spotify-ios/SpotifyiOS.podspec`
- `android/spotify-native-sdk.gradle`

No Spotify native binaries are listed in `files`. `scripts/verify-npm-pack.sh` enforces this at publish time.

## Local development workflow

```sh
yarn install

cd example

# Android — Gradle downloads AAR on first build (network required)
npx expo run:android

# iOS — CocoaPods downloads xcframework at pod install (network required)
npx expo prebuild --clean
cd ios && pod install && cd ..
# xcodebuild …  (see ADR-0009 validation) — avoids starting Metro via expo run:ios
```

Plugin-only work (`yarn test`, `yarn lint`, `yarn typecheck`) does not need native builds.

## Bumping Spotify SDK versions

1. Update `ios/spotify-native-sdk-versions.json`:
   - **iOS:** `version`, `tarballSha256`, `binarySha256`.
   - **Android:** `appRemoteVersion`, `appRemoteReleaseTag`, `appRemoteSha256`.
2. Ship a new `@wwdrew/expo-spotify-sdk` release.

For the SDK 55 lane, see [ADR-0008 § Cherry-pick to v1](../adr/0008-ios-spotify-sdk-via-spm.md#cherry-pick-to-v1-sdk-55-lane).
