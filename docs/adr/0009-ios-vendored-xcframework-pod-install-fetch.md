# ADR-0009: iOS xcframework fetch at pod install (vendored, no SPM, no npm bundle)

- **Status:** Proposed (spike)
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
4. **Mirror Android** (fetch at app native build setup, pinned + SHA-256 verified)

### Why not `prepare_command` in the podspec?

CocoaPods **does not run `prepare_command` for `:path` pods** — and Expo autolinking always uses `:path` to `node_modules/@wwdrew/expo-spotify-sdk/ios`. This is the same class of problem that blocked naive pod-install fetch in ADR-0001.

### Why `pre_install` in the app Podfile?

`pre_install` runs at the start of every `pod install`, before CocoaPods integrates pods. Injecting it via the **Expo config plugin** (`withPodfile`) means:

- Expo apps get the hook automatically on `expo prebuild`
- The fetch script runs in `node_modules/.../ios/` before `vendored_frameworks` is resolved
- No SPM, no npm redistribution

## Decision

**iOS:** `vendored_frameworks` + `ios/fetch-spotify-ios-sdk.sh`, triggered by a config-plugin-injected Podfile `pre_install` hook.

**Android:** unchanged — Gradle `preBuild` download ([ADR-0008](./0008-ios-spotify-sdk-via-spm.md)).

### iOS components

| Piece | Role |
| --- | --- |
| `ios/fetch-spotify-ios-sdk.sh` | Idempotent download from Spotify GitHub tag; SHA-256 verify; writes `ios/SpotifySDK/SpotifyiOS.xcframework` |
| `ios/spotify-native-sdk-versions.json` | Pin `version`, `tarballSha256`, `binarySha256` |
| `plugin/.../withSpotifyIosPodInstallFetch.ts` | Injects tagged `pre_install` block after `platform :ios` |
| `ios/ExpoSpotifySDK.podspec` | `s.vendored_frameworks = "SpotifySDK/SpotifyiOS.xcframework"` (no `spm_dependency`) |

### Bare React Native

Consumers without the config plugin must either:

- Run `bash node_modules/@wwdrew/expo-spotify-sdk/ios/fetch-spotify-ios-sdk.sh` before `pod install`, or
- Copy the `pre_install` block from `withSpotifyIosPodInstallFetch.ts` into their Podfile

## Consequences

### Positive

- Zero Spotify binaries in npm
- Works with `static_framework = true` and `ios.useFrameworks: "static"`
- Symmetric with Android build-time fetch model
- Single version pin file

### Negative

- Network required on first iOS `pod install` per machine
- Depends on config plugin for Expo managed workflow (bare apps need manual hook or script)
- `node` must be on PATH during `pod install` (already required by Expo/RN Podfiles)

### Neutral

- Fetched xcframework cached under `node_modules/.../ios/SpotifySDK/` (gitignored in repo checkout)
- Contributors can use `yarn fetch-native-sdks` without re-running prebuild

## Validation

1. `bash scripts/verify-npm-pack.sh` — tarball contains fetch script, not xcframework
2. `npx expo prebuild --clean` in example → Podfile contains tagged `pre_install`
3. `cd example/ios && pod install` → fetch log, `[CP] Copy XCFrameworks` for SpotifyiOS
4. `xcodebuild` simulator build succeeds
5. Consumer app with `ios.useFrameworks: "static"` builds without SPM
