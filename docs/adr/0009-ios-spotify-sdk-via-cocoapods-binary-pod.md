# ADR-0009: iOS Spotify SDK via CocoaPods binary pod (HTTP download at pod install)

- **Status:** Proposed
- **Date:** 2026-06-08
- **Deciders:** @wwdrew
- **Supersedes:** iOS portion of [ADR-0008](./0008-ios-spotify-sdk-via-spm.md)

## Context

ADR-0008 resolved `SpotifyiOS` via SPM (`spm_dependency`) at `pod install`. That fails in real apps using `ios.useFrameworks: "static"` with static Expo modules — SPM and vendored static pods do not compose reliably.

ADR-0001 bundled the xcframework in npm. That works but re-distributes Spotify binaries (~1 MB tarball bloat) and is legally grey vs Developer Terms.

We need iOS to:

1. **Not use SPM**
2. **Not bundle Spotify code in npm**
3. **Work with static CocoaPods frameworks**
4. **Mirror Android** (fetch at app native build setup, pinned version)

### Why not `prepare_command` on the Expo module podspec?

CocoaPods **does not run `prepare_command` for `:path` pods** — and Expo autolinking always uses `:path` to `node_modules/@wwdrew/expo-spotify-sdk/ios`.

### Why a separate `SpotifyiOS` pod with `:podspec`?

A dedicated `spotify-ios/SpotifyiOS.podspec` referenced from the app Podfile via `:podspec` (not `:path`) uses `source: { http: ... }`. CocoaPods then downloads the Spotify GitHub release tarball and runs `prepare_command` to extract `SpotifyiOS.xcframework`.

`expo-module.config.json` sets `"podspecPath": "ios/ExpoSpotifySDK.podspec"` so autolinking does not also pick up `SpotifyiOS.podspec` as a duplicate `:path` pod.

## Decision

**iOS:** Config plugin injects `pod 'SpotifyiOS', :podspec => ...` into the app Podfile. `ExpoSpotifySDK` depends on `SpotifyiOS`. No SPM.

**Android:** unchanged — Gradle `preBuild` download ([ADR-0001](./0001-build-time-download-of-spotify-native-sdks.md)).

### iOS components

| Piece | Role |
| --- | --- |
| `spotify-ios/SpotifyiOS.podspec` | HTTP binary pod; `prepare_command` extracts `SpotifyiOS.xcframework` |
| `ios/spotify-native-sdk-versions.json` | Pin `version` (and checksums for maintainer reference) |
| `plugin/.../withSpotifyIosPod.ts` | Injects tagged `pod` line after `use_expo_modules!` |
| `expo-module.config.json` | `podspecPath` limits autolinking to `ExpoSpotifySDK` only |
| `ios/ExpoSpotifySDK.podspec` | `s.dependency 'SpotifyiOS'` (no `spm_dependency`, no vendored xcframework) |

### Bare React Native

Consumers without the config plugin must add the same `pod` line to their Podfile (see README bare-install section).

## Consequences

### Positive

- Zero Spotify binaries in npm
- Works with `static_framework = true` and `ios.useFrameworks: "static"`
- Standard CocoaPods binary pod pattern (no `pre_install` bash hooks)
- Symmetric with Android build-time fetch model

### Negative

- Network required on first iOS `pod install` per machine
- Bare apps without the config plugin need the Podfile `pod` line manually
- Two pod targets (`SpotifyiOS` + `ExpoSpotifySDK`) instead of one SPM product

### Neutral

- Downloaded xcframework cached under CocoaPods `Pods/` (not in git or npm)
- `scripts/verify-npm-pack.sh` asserts tarball shape at publish time

## Validation

1. `bash scripts/verify-npm-pack.sh` — tarball contains podspec, not xcframework
2. `npx expo prebuild --clean` in example → Podfile contains tagged `pod 'SpotifyiOS'`
3. `cd example/ios && pod install` → `[CP] Copy XCFrameworks` for SpotifyiOS
4. `xcodebuild` simulator build succeeds
5. Consumer app with `ios.useFrameworks: "static"` builds without SPM
