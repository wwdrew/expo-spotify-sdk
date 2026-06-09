# ADR-0008: Native Spotify SDKs resolved at build time

- **Status:** Accepted (Android only; iOS superseded by [ADR-0009](./0009-ios-vendored-xcframework-pod-install-fetch.md))
- **Date:** 2026-06-06
- **Deciders:** @wwdrew
- **Supersedes:** [ADR-0001](./0001-build-time-download-of-spotify-native-sdks.md) (both platforms)

## Context

ADR-0001 bundled Spotify native binaries in the npm tarball (~1.5 MB). That worked but:

- Re-distributes Spotify binaries via npm (legal grey area vs Developer Terms).
- Bloats the tarball for platform-specific dependencies many consumers never use.

Spotify distributes differently per platform:

| Platform | SDK | Channel |
| --- | --- | --- |
| iOS | `SpotifyiOS` | GitHub + Swift Package Manager |
| Android (Auth) | `com.spotify.android:auth` | Maven Central (already on-demand) |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | GitHub release asset only |

React Native 0.75+ exposes `spm_dependency` in podspecs. Android has no equivalent package manager for App Remote, but Gradle can download the AAR in a `preBuild` task.

We validated on Expo SDK 56 / RN 0.85:

- iOS: `pod install` resolves `SpotifyiOS` 5.0.1; `xcodebuild` succeeds with `static_framework = true`.
- Android: `downloadSpotifyAppRemoteAar` fetches the pinned AAR; Gradle compile succeeds.

## Decision

**Do not ship Spotify native binaries in npm.** Resolve them at native build time:

**iOS:** `spm_dependency` in `ExpoSpotifySDK.podspec`, pinned in `ios/spotify-native-sdk-versions.json`.

**Android:** `android/spotify-native-sdk.gradle` downloads the App Remote AAR from Spotify's GitHub releases before `:preBuild`, SHA-256 verified, pinned in the same JSON file (`android` section).

### iOS podspec requirements

1. `require` React Native's `react_native_pods` and call `spm_dependency` (RN ≥ 0.75).
2. Keep `static_framework = true` (Expo Modules convention; validated on SDK 56 default Podfile).

### Android Gradle requirements

1. `apply from: 'spotify-native-sdk.gradle'` in `android/build.gradle`.
2. `preBuild.dependsOn('downloadSpotifyAppRemoteAar')` — idempotent via `.version` marker + checksum.
3. `implementation files(spotifyAppRemoteAarFile)` — Gson and other transitive deps declared explicitly.

### npm packaging

- Remove `ios/SpotifySDK/` entirely (legacy vendored xcframework path).
- Remove Android AAR from `package.json` `files`.
- Delete `scripts/fetch-spotify-sdks.sh` — no pre-publish fetch step.

Version pin file: `ios/spotify-native-sdk-versions.json` (shared `ios` + `android` sections).

## Consequences

### Positive

- npm tarball contains **zero** Spotify native binaries.
- Both platforms fetch from Spotify's official GitHub channel at native build time.
- No redistribution of Spotify binaries through npm.
- Single version pin file shared across release lanes.
- Symmetric consumer experience: network required on first native build per platform.

### Negative

- Native builds require network on first compile (`pod install` / Gradle download).
- `spm_dependency` + `static_framework` emits CocoaPods warnings; `USE_FRAMEWORKS=dynamic` not validated on all Expo versions.
- Requires RN 0.75+ (Expo SDK 52+). Supported lanes (SDK 55 `v1`, SDK 56+ `main`) satisfy that.
- Gradle download logic is more code than `spm_dependency`, but self-contained in one file.

### Neutral

- Android Auth SDK remains on Maven Central — not vendored.
- Downloaded AAR cached under `node_modules/.../android/libs/` (gitignored in repo checkout).

## Cherry-pick to `v1` (SDK 55 lane)

Apply the same commit(s) to `v1`, resolving only the pre-existing podspec platform line:

| File | `main` | `v1` (keep when cherry-picking) |
| --- | --- | --- |
| `ios/spotify-native-sdk-versions.json` | identical | identical |
| `android/spotify-native-sdk.gradle` | identical | identical |
| `ios/ExpoSpotifySDK.podspec` | `s.platform :ios, '16.4'` | `s.platform :ios, '15.1'` |
| `package.json` `files` | identical | identical |
| Docs / ADR-0008 | identical | identical (adjust lane names in prose if needed) |

No config-plugin changes required. After cherry-pick:

- iOS: `cd example/ios && pod install`, then `xcodebuild`
- Android: `cd example/android && ./gradlew :wwdrew_expo-spotify-sdk:assembleRelease` (or full app build)

## Validation

1. iOS: `cd example/ios && pod install` — `[SPM] Adding SPM dependency on product ["SpotifyiOS"]`.
2. iOS: `xcodebuild -workspace … -scheme … -sdk iphonesimulator build` succeeds (no Metro).
3. Android: delete `android/libs/*.aar`, run Gradle build — `downloadSpotifyAppRemoteAar` fetches AAR, compile succeeds.
