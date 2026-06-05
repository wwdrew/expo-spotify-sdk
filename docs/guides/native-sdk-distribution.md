# Native SDK distribution

How Spotify's iOS and Android SDK binaries reach consumers of `@wwdrew/expo-spotify-sdk`.

See [ADR-0001](../adr/0001-build-time-download-of-spotify-native-sdks.md) for the decision record.

## Summary

| Audience | What happens |
| --- | --- |
| **npm consumers** | `npm install` gets a self-contained package. The tarball includes `SpotifyiOS.xcframework` and `spotify-app-remote-release-0.8.0.aar`. No extra download step at `pod install` or Gradle build time. |
| **git contributors** | Binaries are **gitignored**. Run `yarn fetch-native-sdks` once after clone before native builds or `npx expo run:*`. |
| **release CI** | `prepublishOnly` runs `yarn fetch-native-sdks`, then `scripts/verify-npm-pack.sh` asserts both binaries are in the tarball before `npm publish`. |

## What is bundled

| Platform | Artifact | Source | Pinned version |
| --- | --- | --- | --- |
| iOS | `ios/SpotifySDK/SpotifyiOS.xcframework` | [spotify/ios-sdk](https://github.com/spotify/ios-sdk) tag tarball | `5.0.1` |
| Android (App Remote) | `android/libs/spotify-app-remote-release-0.8.0.aar` | [spotify/android-sdk releases](https://github.com/spotify/android-sdk/releases) | `0.8.0` (`v0.8.0-appremote_v2.1.0-auth`) |
| Android (Auth) | Maven `com.spotify.android:auth:4.0.1` | Maven Central | resolved at Gradle build time (not vendored) |

~1.5 MB added to the npm tarball (mostly the xcframework).

## Fetch script

`scripts/fetch-spotify-sdks.sh` (also `yarn fetch-native-sdks`):

1. Downloads pinned artifacts from Spotify's GitHub.
2. Verifies SHA-256 checksums (mismatch = hard fail).
3. Writes into `ios/SpotifySDK/` and `android/libs/`.
4. Skips re-download when `.version` marker files match and artifacts are present.

Pinned constants live in the script. `android/build.gradle` references the AAR filename; keep both in sync when bumping versions.

## npm packaging

`package.json` `files` explicitly lists:

- `android/libs/spotify-app-remote-release-0.8.0.aar`
- `ios/SpotifySDK/SpotifyiOS.xcframework`
- `ios/SpotifySDK/Licenses`

`scripts/verify-npm-pack.sh` runs in CI and `prepublishOnly`. It fails if either binary is missing from `npm pack --dry-run` output, or if `android/build/` artifacts leak into the tarball.

## Local development workflow

```sh
# After cloning the repo
yarn install
yarn fetch-native-sdks   # required before native builds from git

cd example
npx expo run:ios
npx expo run:android
```

Plugin-only work (`yarn test`, `yarn lint`, `yarn typecheck`) does not need the fetch step.

## Bumping Spotify SDK versions

1. Download the new iOS tarball / Android AAR from Spotify's GitHub.
2. Compute SHA-256: `shasum -a 256 <file>`
3. Update constants in `scripts/fetch-spotify-sdks.sh`.
4. Update `android/build.gradle` if the AAR filename changes.
5. Update version pins in `README.md` / `ATTRIBUTION.md` if the major Spotify SDK version changes.
6. Run `yarn fetch-native-sdks && yarn prepublishOnly` locally.
7. Ship a new `@wwdrew/expo-spotify-sdk` release.

## Why not git submodules or consumer-side download?

We considered:

- **Git submodules** — extra clone friction; still need a copy step before npm pack.
- **Build-time download** (`pod install` / Gradle) — simpler git/npm, but consumers need network on first native build and release CI broke when Android AAR was gitignored.

**Fetch-at-publish** keeps git lean, makes release CI reliable, and gives npm consumers a self-contained install with one script to maintain.

## Future: build-time download?

Consumer-side fetch (`pod install` / Gradle) remains an option if someone can make it reliable end-to-end. Prior attempts in this repo and elsewhere tend to fail on practical details — e.g. CocoaPods `prepare_command` not having `PODS_TARGET_SRCROOT` set during `pod install`, separate per-platform mechanisms, and release CI still needing a story when binaries are gitignored.

**Current priority:** a working library for npm consumers. Revisit build-time download only if there is a proven, tested path (including clean CI and clean `npm install` → native build) — not as a speculative refactor.
