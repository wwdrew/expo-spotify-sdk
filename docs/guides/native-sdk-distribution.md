# Native SDK distribution

How Spotify's iOS and Android SDK binaries reach consumers of `@wwdrew/expo-spotify-sdk`.

See [ADR-0008](../adr/0008-ios-spotify-sdk-via-spm.md) (supersedes [ADR-0001](../adr/0001-build-time-download-of-spotify-native-sdks.md)).

## Summary

| Audience | What happens |
| --- | --- |
| **npm consumers** | `npm install` — no Spotify binaries in the tarball. Native SDKs resolved at build time. |
| **npm consumers (iOS)** | `pod install` resolves `SpotifyiOS` from Spotify's GitHub via SPM. Network required on first iOS native build. |
| **npm consumers (Android)** | Gradle `preBuild` downloads App Remote AAR from Spotify's GitHub. Network required on first Android native build. |
| **git contributors** | Same as npm consumers — no manual fetch scripts. |
| **release CI** | `prepublishOnly` runs `yarn build` and `yarn build:plugin`. |

## What is bundled / resolved

| Platform | Artifact | How it arrives | Pinned version |
| --- | --- | --- | --- |
| iOS | `SpotifyiOS` (SPM) | `spm_dependency` → [spotify/ios-sdk](https://github.com/spotify/ios-sdk) at `pod install` | `5.0.1` |
| Android (App Remote) | `spotify-app-remote-release-0.8.0.aar` | Gradle download at build → [spotify/android-sdk releases](https://github.com/spotify/android-sdk/releases) | `0.8.0` |
| Android (Auth) | Maven `com.spotify.android:auth:4.0.1` | Maven Central | resolved at Gradle build time |

Version pins: `ios/spotify-native-sdk-versions.json` (`ios` and `android` sections).

**Zero** Spotify native binaries in the npm tarball.

## npm packaging

`package.json` `files` includes:

- `ios/spotify-native-sdk-versions.json`
- `android/spotify-native-sdk.gradle`

No Spotify native binaries are listed in `files`.

## Local development workflow

```sh
yarn install

cd example

# Android — Gradle downloads AAR on first build (network required)
npx expo run:android

# iOS — SPM fetch at pod install (network required)
cd ios && pod install && cd ..
# xcodebuild …  (see ADR-0008 validation) — avoids starting Metro via expo run:ios
```

Plugin-only work (`yarn test`, `yarn lint`, `yarn typecheck`) does not need native builds.

## Bumping Spotify SDK versions

1. Update `ios/spotify-native-sdk-versions.json`:
   - **iOS:** `spmVersion` (and repo URL/product if needed).
   - **Android:** `appRemoteVersion`, `appRemoteReleaseTag`, `appRemoteSha256`.
2. Ship a new `@wwdrew/expo-spotify-sdk` release.

## Cherry-pick to `v1`

See [ADR-0008 § Cherry-pick to v1](../adr/0008-ios-spotify-sdk-via-spm.md#cherry-pick-to-v1-sdk-55-lane).
