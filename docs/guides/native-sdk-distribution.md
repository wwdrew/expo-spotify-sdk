# Native SDK distribution

How Spotify's iOS and Android SDK binaries reach consumers of `@wwdrew/expo-spotify-sdk`.

- **iOS:** [ADR-0009](../adr/0009-ios-vendored-xcframework-pod-install-fetch.md) — fetch at app `pod install` via config plugin.
- **Android:** [ADR-0008](../adr/0008-ios-spotify-sdk-via-spm.md) — Gradle download at build time.

## Summary

| Audience | What happens |
| --- | --- |
| **npm consumers** | `npm install` — no Spotify binaries in the tarball. |
| **npm consumers (iOS)** | Config plugin injects Podfile `pre_install` → fetch xcframework before `pod install`. Network on first iOS native setup. |
| **npm consumers (Android)** | Gradle `preBuild` downloads App Remote AAR. Network on first Android native build. |
| **git contributors** | `yarn fetch-native-sdks` for iOS without re-prebuild; Android Gradle download unchanged. |
| **release CI** | `prepublishOnly` runs `verify-npm-pack.sh` (asserts no binaries in tarball). |

## What is bundled / resolved

| Platform | Artifact | How it arrives |
| --- | --- | --- |
| iOS | `SpotifyiOS.xcframework` | `pre_install` fetch at app `pod install` → `vendored_frameworks` |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | Gradle download at build |
| Android (Auth) | `com.spotify.android:auth` | Maven Central |

Version pins: [`ios/spotify-native-sdk-versions.json`](../ios/spotify-native-sdk-versions.json).

**Zero** Spotify native binaries in the npm tarball.

## npm packaging

`package.json` `files` includes `ios/fetch-spotify-ios-sdk.sh` and `ios/SpotifySDK/SETUP.md` — not the xcframework.

## Local development workflow

```sh
yarn install
yarn fetch-native-sdks   # optional if you will prebuild / pod install

cd example
npx expo prebuild --clean   # injects Podfile fetch hook

cd ios && pod install && cd ..
# xcodebuild …
```

## Bumping Spotify SDK versions

1. Update `ios/spotify-native-sdk-versions.json` (`ios` and `android` sections).
2. Ship a new release.
