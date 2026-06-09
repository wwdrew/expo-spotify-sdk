# Native SDK distribution

How Spotify's iOS and Android SDK binaries reach consumers of `@wwdrew/expo-spotify-sdk`.

- **iOS:** [ADR-0001](../adr/0001-build-time-download-of-spotify-native-sdks.md) — fetch before `npm publish`, bundle xcframework in npm.
- **Android:** [ADR-0008](../adr/0008-ios-spotify-sdk-via-spm.md) — Gradle download at build time.

## Summary

| Audience | What happens |
| --- | --- |
| **npm consumers** | `npm install` — iOS xcframework is in the tarball. Android App Remote downloaded on first Gradle build. |
| **npm consumers (iOS)** | `SpotifyiOS.xcframework` vendored via CocoaPods. No network required after install. |
| **npm consumers (Android)** | Gradle `preBuild` downloads App Remote AAR from Spotify's GitHub. Network required on first Android native build. |
| **git contributors** | Run `yarn fetch-native-sdks` after clone (iOS only). Android still downloads at Gradle build. |
| **release CI** | `prepublishOnly` fetches iOS SDK, builds, and runs `verify-npm-pack.sh`. |

## What is bundled / resolved

| Platform | Artifact | How it arrives |
| --- | --- | --- |
| iOS | `SpotifyiOS.xcframework` | Fetched before `npm publish` → bundled in npm → `vendored_frameworks` in podspec |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | Gradle download at build → [spotify/android-sdk releases](https://github.com/spotify/android-sdk/releases) |
| Android (Auth) | `com.spotify.android:auth` | Maven Central (version in `android/build.gradle`) |

Version pins: [`ios/spotify-native-sdk-versions.json`](../ios/spotify-native-sdk-versions.json) (`ios` and `android` sections).

## npm packaging

`package.json` `files` includes:

- `ios/SpotifySDK/SpotifyiOS.xcframework`
- `ios/SpotifySDK/Licenses`
- `ios/spotify-native-sdk-versions.json`
- `android/spotify-native-sdk.gradle`

Android App Remote AAR is **not** in the npm tarball (Gradle fetches it).

## Local development workflow

```sh
yarn install
yarn fetch-native-sdks   # iOS xcframework (gitignored)

cd example

# Android — Gradle downloads AAR on first build (network required)
npx expo run:android

# iOS
cd ios && pod install && cd ..
# xcodebuild …  — avoids starting Metro via expo run:ios
```

Plugin-only work (`yarn test`, `yarn lint`, `yarn typecheck`) does not need native builds.

## Bumping Spotify SDK versions

1. Update `ios/spotify-native-sdk-versions.json`:
   - **iOS:** `version`, `tarballSha256`, `binarySha256`.
   - **Android:** `appRemoteVersion`, `appRemoteReleaseTag`, `appRemoteSha256`.
2. Run `yarn fetch-native-sdks && bash scripts/verify-npm-pack.sh` (iOS).
3. Ship a new `@wwdrew/expo-spotify-sdk` release.

## Cherry-pick to `v1`

See [ADR-0008 § Cherry-pick to v1](../adr/0008-ios-spotify-sdk-via-spm.md#cherry-pick-to-v1-sdk-55-lane) for Android. iOS vendoring is identical across lanes (adjust podspec `s.platform` only).
