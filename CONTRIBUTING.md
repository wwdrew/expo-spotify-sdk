# Contributing to expo-spotify-sdk

Thank you for your interest in contributing. This document covers everything
you need to get a PR merged.

## Table of contents

- [Development setup](#development-setup)
- [Spotify native SDK binaries](#spotify-native-sdk-binaries)
- [Making changes](#making-changes)
- [Commit messages](#commit-messages)
- [Tests](#tests)
- [Pull request checklist](#pull-request-checklist)
- [Release process](#release-process)

---

## Which branch?

| You are… | Branch | Expo SDK |
| --- | --- | --- |
| Adding features or fixing bugs for current consumers | **`main`** | 56+ (`2.x`) |
| Backporting a fix for SDK 55 users | **`v1`** | 55 (`1.x`) |

PRs should target **`main`** by default. The **`v1`** branch is frozen at the SDK 55 toolchain — do not merge `main` into `v1`.

## Development setup

Work on **`main`** unless you are explicitly maintaining the SDK 55 lane:

```sh
# 1. Fork and clone
git clone https://github.com/<you>/expo-spotify-sdk.git
cd expo-spotify-sdk
git checkout main

# 2. Install dependencies (Yarn v1 — matches CI)
yarn install

# 3. Bootstrap the example app
cd example && npm install && cd ..

# 4. Run plugin tests (fast, no Xcode/Android Studio needed)
yarn test
```

### Spotify native SDK binaries

Spotify native binaries are **not** committed to git or bundled in npm. They are resolved at native build time — iOS via CocoaPods HTTP binary pod at `pod install`, Android via Gradle download at build ([ADR-0009](./docs/adr/0009-ios-spotify-sdk-via-cocoapods-binary-pod.md)).

Full details: [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md).

**Bumping Spotify SDK versions:** update `ios/spotify-native-sdk-versions.json`.

### What you need

| Task | Requirement |
|---|---|
| Plugin tests | Node.js ≥ 20 |
| iOS native development | Xcode 26.4+ (Expo SDK 56), macOS |
| Android native development | Android Studio Meerkat, JDK 17+ |
| Example app | Expo Go or a development build |

## Making changes

### TypeScript / plugin

```sh
yarn test          # plugin Jest tests
yarn typecheck     # tsc --noEmit (module src)
yarn lint          # ESLint
yarn build         # compile src/ → build/
yarn build:plugin  # compile plugin/ → plugin/build/
```

We keep `expo-module-scripts` for shared config (`tsconfig`, ESLint presets) but call `tsc` / `jest` / `eslint` directly instead of the `expo-module` CLI. The published `expo-module-scripts` tarball ships subcommand files without the executable bit, so `expo-module prepare` (and other subcommands) fail on a clean Linux install — see [ADR-0007](./docs/adr/0007-bypass-expo-module-cli.md).

### iOS native (`ios/`)

Requires network for `pod install` (CocoaPods downloads `SpotifyiOS` from GitHub).

```sh
cd example/ios && pod install && cd ..
# Prefer xcodebuild over `expo run:ios` in CI — avoids starting Metro
xcodebuild -workspace expospotifysdkexample.xcworkspace \
  -scheme expospotifysdkexample -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
```

### Android native (`android/`)

Gradle downloads the App Remote AAR on first build (network required).

```sh
cd example
npx expo run:android
```

The example app's Android `namespace` / `applicationId` is
`expo.modules.spotifysdk.example` (see `example/app.json`). After
`npx expo prebuild`, Kotlin sources should live only under
`example/android/app/src/main/java/expo/modules/spotifysdk/example/`.
Delete any orphan `com/` tree left over from an old package name — CI runs
`scripts/verify-example-android-package.sh` to catch this.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
Commit message style is enforced by CI (`commitlint`); the build will fail if
your PR's commit messages don't conform.

**Format:** `<type>(<scope>): <description>`

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.

Examples:

```
feat(android): handle TOKEN flow scopes limitation warning
fix(ios): guard against concurrent authentication calls
docs: expand token-swap server contract section
test(plugin): add idempotency test for withSpotifyURLScheme
```

**Breaking changes:** add `!` after the type or add a `BREAKING CHANGE:` footer:

```
feat!: rename SpotifyConfig.scopes to SpotifyConfig.permissions

BREAKING CHANGE: SpotifyConfig.scopes has been renamed to SpotifyConfig.permissions.
```

## Tests

Plugin tests live in `plugin/src/__tests__/`. Run them with:

```sh
yarn test
```

When adding new plugin modifiers, add a corresponding test that checks:

1. The modifier applies the expected change.
2. Running the modifier a second time is idempotent.

When changing auth error mapping on iOS or Android, update both native implementations and the scenario matrix in [`docs/auth-error-mapping.md`](docs/auth-error-mapping.md). Run through the manual checklist in that doc on both platforms.

When changing App Remote error mapping on iOS or Android, update both native mappers and [`src/internal/app-remote-error-mapping.fixture.json`](src/internal/app-remote-error-mapping.fixture.json). Run `yarn test` — the fixture test guards drift between platforms and the TypeScript error unions.

## Pull request checklist

- [ ] `yarn test` passes locally.
- [ ] `yarn typecheck` passes.
- [ ] `yarn lint` passes (or only pre-existing warnings remain).
- [ ] Commit messages follow Conventional Commits.
- [ ] New public API is annotated with JSDoc.
- [ ] README updated if behaviour or public API changed.
- [ ] If the change is user-facing, it reads sensibly in a CHANGELOG (Release
      Please generates this from your commit messages automatically).

## Release process

- **`2.x` from `main`** — [Release Please](https://github.com/googleapis/release-please) opens a release PR; merging it publishes to npm as **`latest`** (see [docs/RELEASE.md](docs/RELEASE.md)).
- **`1.x` from `v1`** — same Release Please flow on the `v1` branch; merging publishes with npm dist-tag **`sdk55`** (see [docs/RELEASE.md](docs/RELEASE.md)).

Use Conventional Commits on the branch you are releasing from.
