# Contributing to expo-spotify-sdk

Thank you for your interest in contributing. This document covers everything
you need to get a PR merged.

## Table of contents

- [Development setup](#development-setup)
- [Making changes](#making-changes)
- [Commit messages](#commit-messages)
- [Tests](#tests)
- [Pull request checklist](#pull-request-checklist)
- [Release process](#release-process)

---

## Development setup

```sh
# 1. Fork and clone
git clone https://github.com/<you>/expo-spotify-sdk.git
cd expo-spotify-sdk

# 2. Install dependencies (Yarn v1 — matches CI)
yarn install

# 3. Bootstrap the example app
cd example && npm install && cd ..

# 4. Run plugin tests (fast, no Xcode/Android Studio needed)
yarn test
```

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

Open the example app's workspace and build on a simulator or device:

```sh
cd example
npx expo run:ios
```

### Android native (`android/`)

```sh
cd example
npx expo run:android
```

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

Releases are automated via [Release Please](https://github.com/googleapis/release-please).
Merging a commit that triggers a release will open or update a release PR.
When that PR is merged, the workflow publishes to npm automatically — no
manual `npm publish` required.

Maintainers don't need to do anything special beyond merging commits with
well-formed Conventional Commit messages.
