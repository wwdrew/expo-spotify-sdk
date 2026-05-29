# ADR-0007: Bypass `expo-module` CLI for package scripts

- **Status:** Accepted
- **Date:** 2026-05-29
- **Deciders:** @wwdrew

## Context

CI runs `yarn install --frozen-lockfile` on Ubuntu. Install failed during the `prepare` lifecycle with:

```text
Error: '.../node_modules/expo-module-scripts/bin/expo-module-prepare' not executable
```

The module template from Expo recommends:

```json
{
  "scripts": {
    "prepare": "expo-module prepare",
    "build": "expo-module build",
    "lint": "expo-module lint",
    "test": "expo-module test"
  }
}
```

We still depend on `expo-module-scripts` for shared tooling (`tsconfig.base`, ESLint presets, Jest presets).

## Root cause

`expo-module-scripts` uses Commander subcommands implemented as separate files under `bin/` (e.g. `expo-module-prepare`, `expo-module-build`) **without** a `.js` extension. Only `bin/expo-module.js` is listed in the package's npm `bin` field.

When npm publishes the package, **only** `bin` entries are stored in the tarball with mode `755`. Subcommand files are shipped as `644`. Commander 12 spawns extensionless subcommands via `child_process.spawn(path)` (not `node path`), which requires the executable bit on Unix — yielding `EACCES` on a clean install.

In SDK 56, `expo-module prepare` is a **noop** (prints a warning to run `expo-module configure` once). The failure happens before any useful work runs.

The same permission issue affects `build`, `lint`, and `test`, because those scripts chain additional extensionless bins (e.g. `expo-module-build` → `expo-module-tsc` via `@expo/spawn-async`).

Expo's monorepo source declares `publishConfig.executableFiles` for Yarn packing, but the **published** `expo-module-scripts@56.0.2` registry tarball still ships subcommand files as non-executable; npm consumers are affected regardless of package manager.

## Decision

Keep `expo-module-scripts` as a devDependency for configuration only. Replace `expo-module …` script entries with direct invocations of the underlying tools:

| Former | Replacement |
| --- | --- |
| `expo-module prepare` | Removed (noop in v56) |
| `expo-module build` | `tsc` |
| `expo-module build` (plugin) | `tsc -p plugin/tsconfig.json` (`build:plugin`) |
| `expo-module lint` | `eslint src` |
| `expo-module test plugin` | `jest --rootDir plugin --config plugin/jest.config.js` |
| `expo-module typecheck` | `tsc --noEmit` |
| `expo-module prepublishOnly` | `yarn clean && yarn build && yarn build:plugin` |

Use **Yarn v1** at the repo root (`.github/workflows` + `yarn.lock`). Remove the stale root `package-lock.json` (SDK 55) to avoid mixed-lockfile warnings.

## Consequences

- **Positive:** `yarn install` and CI work on Linux without `postinstall` chmod hacks.
- **Positive:** Scripts are explicit and easy to read in `package.json`.
- **Negative:** We no longer pick up future behavior changes in `expo-module-scripts` bin wrappers automatically (e.g. watch mode, `plugin` path sugar). Acceptable — our scripts are stable and documented in CONTRIBUTING.
- **Negative:** `expo-module configure` is not run on install; generated files (`tsconfig.json` with `@generated`) are committed and updated manually when upgrading `expo-module-scripts`.

## Upstream

Track/fix in [expo/expo#46404](https://github.com/expo/expo/issues/46404) (`packages/expo-module-scripts`): ensure subcommand bins are executable in the published tarball, or spawn them via `node` / use `.js` extensions so Commander does not require `+x`.
