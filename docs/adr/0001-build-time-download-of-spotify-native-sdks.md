# ADR-0001: Build-Time Download of Spotify Native SDKs

- **Status:** Proposed
- **Date:** 2026-05-07
- **Deciders:** @wwdrew

## Context

This library is an Expo module that wraps Spotify's native iOS and Android SDKs to provide OAuth authentication (and, in a follow-up, App Remote playback control) inside React Native / Expo apps.

Spotify ships its native SDKs through unusual channels:

| Platform | SDK | How Spotify distributes it |
| --- | --- | --- |
| iOS | `SpotifyiOS.xcframework` | Checked into [`github.com/spotify/ios-sdk`](https://github.com/spotify/ios-sdk) at the repo root. Releases tag the repo but **publish no asset binaries** (`assets: []`). A `Package.swift` declares a local-path `binaryTarget`, so SPM consumers clone the whole repo. **Not on CocoaPods.** |
| Android (Auth) | `com.spotify.android:auth` | Officially published to **Maven Central** (latest at time of writing: `4.0.1`, 2026-03-04). |
| Android (App Remote) | `spotify-app-remote-release-<version>.aar` | Direct asset on [`github.com/spotify/android-sdk` releases](https://github.com/spotify/android-sdk/releases). Not on Maven Central. Tag scheme is irregular: `v0.8.0-appremote_v2.1.0-auth`. |

### Today's integration

- **iOS:** `SpotifyiOS.xcframework` (~1.2 MB) is checked into this repo at `ios/SpotifySDK/SpotifyiOS.xcframework/` and shipped inside the npm tarball. The podspec wires it via `s.vendored_frameworks`.
- **Android:** Only the auth library is integrated. `android/build.gradle` declares `implementation "com.spotify.android:auth:4.0.1"` from Maven Central. App Remote is not yet supported.
- **README:** Tells consumers to add `implementation 'com.spotify.android:auth:4.0.1'` to *their* `app/build.gradle` themselves — a leaky abstraction.

### Problems with today's setup

1. **Legal / redistribution exposure.** We are republishing Spotify's binary framework via npm without a license that authorises redistribution. The xcframework is licensed for use, not for downstream re-bundling.
2. **Repository bloat.** Every Spotify SDK upgrade produces a binary diff. Every clone pays the 1.2 MB cost forever.
3. **NPM tarball bloat.** The framework ships in every `npm install`, even for users who never build for iOS.
4. **Manual upgrade churn.** Bumping the iOS SDK means downloading Spotify's source, copying files in, and committing a binary. There is no `npm update`-style flow.
5. **No App Remote support.** Adding it today would require either vendoring another binary (compounding problems 1–3) or designing a download mechanism — which we may as well design once and apply to both platforms.
6. **Consumer setup leakage.** Consumers wire the Android auth dep themselves, even though it's an internal implementation detail of this module.

### Constraints

- **No redistribution.** Spotify binaries must not live in our git history nor in our npm tarball.
- **Build-time download, not install-time.** Pulling at `npm install` ties network access to package install and breaks `npm ci` in offline-cached CI layers. Acceptable failure modes: `pod install` and `gradle build` requiring network on a clean checkout.
- **Pinned versions with integrity verification.** Reproducible builds. SHA-256 mismatch = build fails.
- **No new tooling demanded of consumers.** No `gem install …` step, no extra Gradle plugins to learn, no extra Podfile boilerplate beyond what `expo prebuild` already produces.
- **Works on Expo SDK 54+ / RN 0.81+** (the example app's current target).

## Decision

We will **stop vendoring Spotify binaries** and pull them at build time, using each platform's first-class extension points.

### iOS — `prepare_command` in the podspec

The podspec at `ios/ExpoSpotifySDK.podspec` will gain a `prepare_command` block that runs at `pod install` time. It will:

1. Read pinned constants `SPOTIFY_IOS_SDK_VERSION` and `SPOTIFY_IOS_SDK_TARBALL_SHA256` declared at the top of the podspec.
2. Skip if `ios/SpotifySDK/.version` matches `SPOTIFY_IOS_SDK_VERSION` and `ios/SpotifySDK/SpotifyiOS.xcframework/` already exists (idempotent / cached).
3. Otherwise download `https://github.com/spotify/ios-sdk/archive/refs/tags/v<version>.tar.gz` to a temp dir.
4. Verify SHA-256 against the pinned constant. Mismatch fails the build.
5. Extract `SpotifyiOS.xcframework/` and `Licenses/` into `ios/SpotifySDK/`.
6. Write `ios/SpotifySDK/.version` for cache invalidation.

The existing `s.vendored_frameworks = "SpotifySDK/SpotifyiOS.xcframework"` line is unchanged — the framework is just on-demand instead of vendored.

### Android — Custom download task + `flatDir` for App Remote

In `android/build.gradle`:

1. **Auth library: no change.** Keep `implementation "com.spotify.android:auth:<version>"` resolving from Maven Central.
2. **App Remote:** add a `downloadSpotifyAppRemote` Gradle task that runs at configuration time. It will:
   - Read pinned constants `SPOTIFY_APP_REMOTE_VERSION`, `SPOTIFY_APP_REMOTE_TAG`, `SPOTIFY_APP_REMOTE_SHA256`.
   - Download `https://github.com/spotify/android-sdk/releases/download/<tag>/spotify-app-remote-release-<version>.aar` into `$buildDir/spotify-app-remote/` if not already cached, verifying SHA-256.
3. Wire `preBuild.dependsOn downloadSpotifyAppRemote`.
4. Add a `flatDir { dirs ... }` repository pointing at `$buildDir/spotify-app-remote/`.
5. Add `implementation name: "spotify-app-remote-release-<version>", ext: "aar"`.

### Versioning policy

Pinned constants live in **this** package's build configs (podspec + `build.gradle`). One spot to update on upgrades. Bumping a Spotify SDK version becomes:

1. Change two constants and two SHAs in this repo.
2. Ship a new patch release of `@wwdrew/expo-spotify-sdk`.

Consumers do **not** override Spotify SDK versions independently of this library's version. Doing so is unsupported because untested combinations risk silent breakage and become unactionable bug reports.

### Internalising the Android auth dependency

The README's "consumer setup" section will stop instructing users to add `implementation 'com.spotify.android:auth:…'` to their app's `build.gradle`. The dependency already lives in our `android/build.gradle` as `implementation` — it transits to consumers via Gradle's normal dependency resolution. The manifest placeholders (`spotifyClientId`, `spotifyRedirectUri`, etc.) remain in the consumer's `build.gradle`, injected by the existing config plugin.

## Alternatives Considered

### iOS

| Alternative | Verdict | Reason |
| --- | --- | --- |
| `cocoapods-spm` plugin (`s.spm_dependency` in podspec, `spm_pkg` in Podfile) | **Rejected** | Niche third-party gem (97⭐, single maintainer). Imposes a `gem install cocoapods-spm` step on every consumer. Too much friction for a published library. |
| Native Expo SDK 54 SPM support (PR [expo/expo#44248](https://github.com/expo/expo/commit/6aec778139dbbd89af2f2cc58362abb160ac8249)) | **Rejected for now** | Brand new (March 2026), not yet broadly battle-tested for binary `.xcframework` deps in third-party Expo modules. Revisit when stable. |
| `withDangerousMod` config plugin downloading into the consumer's `ios/` tree | **Rejected** | Wrong layer. Bakes timing into `expo prebuild`, fights `expo prebuild --clean`, doesn't run on subsequent `pod install`s, and contaminates the consumer's source tree with files we own. |
| Xcode build-phase script | **Rejected** | Cannot `vendored_frameworks` a path that doesn't exist at podspec-evaluation time. Linking fails before the script runs. |
| NPM `postinstall` script | **Rejected** | Install-time, not build-time. Breaks `npm ci` in offline / cached CI layers. Explicit constraint. |
| Status quo (vendor the binary) | **Rejected** | The driving motivation for this ADR. |

### Android

| Alternative | Verdict | Reason |
| --- | --- | --- |
| `ivy {}` repository with `patternLayout` mapping App Remote to GitHub Releases | **Rejected** | Spotify's tag scheme bakes both the App Remote version and the unrelated Auth version into the same string (`v0.8.0-appremote_v2.1.0-auth`). The ivy pattern would require hard-coding the Auth version portion, creating a brittle coupling that doesn't actually exist in the artifact. |
| `de.undercouch.download` Gradle plugin | **Rejected** | Adds a buildscript dependency for what is effectively five lines of `ant.get` or `URL.openStream`. Overkill. |
| Vendoring the App Remote `.aar` in this repo | **Rejected** | Same redistribution / bloat problem as the iOS xcframework. |
| Status quo (no App Remote) | **Rejected** | Blocks the next phase of work. |

## Consequences

### Positive

- 1.2 MB Spotify binary leaves the git history (after `git filter-repo` or equivalent on the next major release; alternatively, leave history and just stop adding to it).
- Zero Spotify binaries in the npm tarball.
- No "redistributing someone else's licensed binary" exposure — both binaries come straight from `github.com/spotify/...` under Spotify's own hosting at build time.
- Pinned versions + SHAs = reproducible, auditable builds. Supply-chain compromise of the GitHub asset would fail SHA verification.
- Bumping the Spotify SDK becomes a tiny, reviewable PR (two constants + two SHAs).
- App Remote support unblocked — same mechanism, additional pinned constants.
- Consumer setup simplifies: no manual Gradle `implementation` line, no manual Podfile additions.

### Negative

- **First-time clean build requires network access** for both `pod install` and `gradle build`. CI runners without internet for these steps will fail. (In practice, all CI that builds RN apps already needs network access for npm and Maven Central, so this is a non-change.)
- **GitHub Releases availability is now a runtime build-time dependency.** If `github.com` is unreachable or Spotify deletes a release tag, builds break. Mitigation: SHAs are pinned and binaries are typically already cached in `Pods/` or `$buildDir/` between builds.
- **`prepare_command` runs every `pod install`** and pays the cache-check overhead. Tiny, but non-zero.
- **The `prepare_command` pattern is mildly discouraged by CocoaPods docs** in favour of `s.source = { :http => ... }`. We can't use `s.source` because our pod's source IS this repo's Swift code, not the Spotify framework. Many real-world podspecs do exactly what we're doing; the guidance is more conventional than prohibitive.
- **One-time CHANGELOG note required**: bumping past this ADR is a behaviour change for consumers (first build is slower; offline first-build-after-clone fails). Document in the release notes.

### Neutral

- Android Auth library remains on Maven Central. We do not switch it to a GitHub-Releases download for "consistency" — Maven Central is canonical, official, and well-cached on every Gradle install.
- The Expo config plugin keeps the Android manifest-placeholder injection logic; we are not replacing it.

## Implementation Sketch

| File | Change |
| --- | --- |
| `ios/SpotifySDK/SpotifyiOS.xcframework/` | **Delete** (1.2 MB out of repo) |
| `ios/SpotifySDK/.gitignore` | Add `SpotifyiOS.xcframework/`, `.version`, `Licenses/` |
| `.gitignore` (root) | Add `ios/SpotifySDK/SpotifyiOS.xcframework/`, `ios/SpotifySDK/.version`, `ios/SpotifySDK/Licenses/` |
| `ios/ExpoSpotifySDK.podspec` | Add `SPOTIFY_IOS_SDK_VERSION` + `..._SHA256` constants, add `prepare_command` block |
| `android/build.gradle` | Add `SPOTIFY_APP_REMOTE_VERSION` + `..._TAG` + `..._SHA256` constants, `downloadSpotifyAppRemote` task, `flatDir` repo, `preBuild.dependsOn`, App Remote `implementation` line |
| `README.md` | Remove "add `implementation 'com.spotify.android:auth'` to your `app/build.gradle`" section. Add a note that the first build requires network access. |
| `CONTRIBUTING.md` | Document how to bump Spotify SDK versions (compute new SHA via `shasum -a 256`, update constants, regenerate fixture if any). |
| `.npmignore` | Confirm `ios/SpotifySDK/SpotifyiOS.xcframework/` is excluded (defensive). |

## Open Questions

- Should we ship a **fallback** for the rare case where a developer's machine cannot reach `github.com` at build time (e.g. behind a corporate proxy)? Possible mitigation: an env var (`SPOTIFY_IOS_SDK_LOCAL_PATH`) that lets advanced users point at a pre-downloaded copy. Defer until we hit a real user reporting this.
- Should we publish a **GitHub Action** that bumps Spotify SDK versions automatically (Renovate-style, pinned by tag)? Defer until manual bumps become a recurring chore.

## Validation

Before merging the implementation PR, verify:

1. `npm pack --dry-run` shows no `*.xcframework` entries in the tarball file list.
2. From a clean checkout: `cd example && npx expo prebuild --clean && pod install && pod install` (twice) — second run is a no-op, no re-download.
3. `cd example && npx expo run:ios` succeeds; OAuth flow works end-to-end.
4. `cd example && npx expo run:android` succeeds; OAuth flow works end-to-end.
5. Tamper test: temporarily change one byte of the pinned SHA in either build config; confirm the build fails with a clear "checksum mismatch" error rather than silently using a wrong binary.
