# ADR-0001: Fetch-at-Publish, Vendor-in-NPM for Spotify Native SDKs

- **Status:** Superseded by [ADR-0009](./0009-ios-vendored-xcframework-pod-install-fetch.md) (iOS npm bundle) and [ADR-0008](./0008-ios-spotify-sdk-via-spm.md) (Android)
- **Date:** 2026-05-07 (revised 2026-06-05)
- **Deciders:** @wwdrew

## Context

This library is an Expo module that wraps Spotify's native iOS and Android SDKs to provide OAuth authentication and App Remote playback control inside React Native / Expo apps.

Spotify ships its native SDKs through unusual channels:

| Platform | SDK | How Spotify distributes it |
| --- | --- | --- |
| iOS | `SpotifyiOS.xcframework` | Checked into [`github.com/spotify/ios-sdk`](https://github.com/spotify/ios-sdk) at the repo root. Releases tag the repo but **publish no release assets**. **Not on CocoaPods.** |
| Android (Auth) | `com.spotify.android:auth` | **Maven Central** (latest at time of writing: `4.0.1`). |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | Direct asset on [`github.com/spotify/android-sdk` releases](https://github.com/spotify/android-sdk/releases). Not on Maven Central. Tag scheme: `v0.8.0-appremote_v2.1.0-auth`. |

### Problem that motivated this ADR

Early releases assumed Spotify binaries would be available when `npm publish` ran on CI. In practice:

- **Android App Remote `.aar`** was gitignored (`android/libs/*.aar`) — never in the GitHub checkout, never in published npm packages → Android builds failed for consumers.
- **iOS xcframework** was committed to git and sometimes made it into npm, but the setup was inconsistent and bloated the repository.

We need a single, reliable pipeline: **published npm packages always include both native binaries**, while **git stays free of large binary diffs**.

### Constraints

- **Pinned versions with integrity verification.** SHA-256 mismatch = fetch fails.
- **No consumer setup steps** beyond `npm install` — no manual AAR copy, no `pod install` download scripts.
- **Release CI must not depend on gitignored local files** left over from a maintainer's machine.
- **Works on Expo SDK 56+ / RN 0.81+** (current `main` lane).

## Decision

**Fetch Spotify binaries before `npm pack`, bundle them in the npm tarball, keep them out of git.**

1. **`scripts/fetch-spotify-sdks.sh`** downloads pinned iOS (`SpotifyiOS.xcframework` + `Licenses/`) and Android (`spotify-app-remote-release-0.8.0.aar`) from Spotify's GitHub. Verifies SHA-256. Idempotent via `.version` marker files.
2. **`prepublishOnly`** runs `yarn fetch-native-sdks` before TypeScript build and `npm publish`.
3. **`package.json` `files`** explicitly includes the xcframework, Licenses, and AAR paths.
4. **`scripts/verify-npm-pack.sh`** fails CI/publish if the tarball is missing either binary.
5. **`.gitignore`** excludes fetched artifacts — contributors run `yarn fetch-native-sdks` after clone.
6. **Native integration stays simple:** `s.vendored_frameworks` in the podspec; `implementation files('libs/…aar')` in `android/build.gradle`. No `prepare_command`, no Gradle download task.

Operational guide: [docs/guides/native-sdk-distribution.md](../guides/native-sdk-distribution.md).

## Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Commit binaries to git | **Rejected** | Every SDK bump is a large binary diff; clones pay forever. |
| Git submodules of Spotify repos + copy before pack | **Rejected** | Submodule UX is poor (`git submodule update --init`); still needs a copy script; no advantage over direct HTTP fetch. |
| Build-time download (`pod install` / Gradle) | **Rejected** | Consumers need network on first native build; separate mechanisms per platform; we hit `PODS_TARGET_SRCROOT` issues on iOS. |
| `npm postinstall` fetch | **Rejected** | Ties network to install; breaks offline `npm ci` layers. |
| Status quo (hope CI has local files) | **Rejected** | Shipped broken Android builds. |

## Consequences

### Positive

- Published npm packages are **self-contained** — consumers `npm install` and build.
- Release CI is **reliable** — fetch runs in `prepublishOnly` with network; no gitignored-file roulette.
- Git history stays **lean** — binaries not committed.
- One script (`fetch-spotify-sdks.sh`) for fetch, pin, and checksum logic.
- `verify-npm-pack.sh` prevents regression.

### Negative

- **~1.5 MB npm tarball bloat** (xcframework + AAR), including for consumers who only target one platform.
- **Redistribution via npm** — Spotify binaries are re-bundled in our package. Use is subject to [Spotify's Developer Terms](https://developer.spotify.com/terms) and bundled SDK licenses.
- **Maintainers need network** for `yarn fetch-native-sdks` and release publish (acceptable).

### Neutral

- Android Auth SDK remains on Maven Central — not vendored.
- Brief experiment with build-time consumer downloads (June 2026) was reverted in favour of this approach.

## Implementation

| File | Role |
| --- | --- |
| `scripts/fetch-spotify-sdks.sh` | Download + SHA-256 verify + cache markers |
| `scripts/verify-npm-pack.sh` | Assert binaries present in `npm pack` output |
| `package.json` | `fetch-native-sdks` script; `prepublishOnly` hook; explicit `files` entries |
| `.gitignore` | Ignore `android/libs/*.aar`, etc. |
| `ios/ExpoSpotifySDK.podspec` | `s.vendored_frameworks` only (no `prepare_command`) |
| `android/build.gradle` | `implementation files('libs/spotify-app-remote-release-0.8.0.aar')` |
| `.github/workflows/ci.yml` | Fetch + verify on TypeScript build job |
| `.github/workflows/release.yml` | `prepublishOnly` before `npm publish` |

## Bumping Spotify SDK versions

1. Update pinned version + SHA-256 constants in `scripts/fetch-spotify-sdks.sh`.
2. Update `android/build.gradle` AAR filename if needed.
3. Run `yarn fetch-native-sdks && yarn prepublishOnly`.
4. Ship a new npm release.

## Validation

Before merging changes to this pipeline:

1. `yarn fetch-native-sdks && bash scripts/verify-npm-pack.sh` passes.
2. `npm pack` tarball contains both `android/libs/spotify-app-remote-release-0.8.0.aar` and `SpotifyiOS.xcframework/.../SpotifyiOS` binary.
3. From a clean git clone (after `yarn fetch-native-sdks`): `cd example && npx expo run:ios` and `npx expo run:android` succeed.
4. Tamper test: change one byte of a pinned SHA in `fetch-spotify-sdks.sh`; confirm fetch fails with checksum mismatch.
