# ADR-0005: Major versions track Expo SDK lanes

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** @wwdrew

## Context

Expo SDK 56 raised the minimum iOS deployment target from 15.1 to 16.4 and shipped `expo-modules-core@^4.x` with `s.platforms = { :ios => '16.4' }` in its podspec. Any custom Expo module that depends on `expo-modules-core` inherits that floor at install time.

The release before this ADR is `0.8.0`. It targets Expo SDK 55 (iOS 15.1 minimum) via `expo-modules-core@^3.x`. The library is at the same time about to add a large new feature set (App Remote SDK wrapping — see [ADR-0006](./0006-namespaced-api-and-app-remote-scope.md)) which will hit a major version bump regardless of SDK considerations.

Two real constraints collide:

1. **One package version cannot cleanly satisfy both SDK 55 and SDK 56.** CocoaPods resolves the podspec floor strictly. A pod requiring iOS 15.1 will install into an SDK 56 app (the app's floor is higher, that's fine), but a pod requiring iOS 16.4 will fail to install into an SDK 55 app (`expo-modules-core@^3.x` doesn't satisfy the dep). We have to pick one floor in the podspec, and that picks the SDK lane.
2. **Consumers on SDK 55 are not all able to upgrade.** Many apps have other dependencies pinned to SDK 55, or organisational constraints on Expo SDK bumps, and want App Remote functionality on their current setup rather than waiting until they can bump.

### Options considered

- **One package version, lowest-common-denominator code.** Develop against `expo-modules-core@^3.x` API. Podspec at 15.1. Works on both SDK lanes from one source tree, at the cost of giving up SDK 56's improvements (new JSI layer, Kotlin compiler plugin, prebuilt XCFrameworks) until SDK 55 is dropped from the support matrix. Rejected because the maintainer wants each branch to take full advantage of its SDK lane.
- **Clean break: v1 = SDK 56 only, no SDK 55 support past 0.8.x.** Simpler maintenance but leaves SDK 55 consumers stuck without App Remote. Rejected because the maintainer explicitly wants SDK 55 consumers to be able to use the App Remote feature set.
- **Two majors, each pinned to its SDK lane.** `v1.x.x` for SDK 55, `v2.x.x` for SDK 56+. Both ship the full feature set, developed independently per branch.

The pattern of "major version tracks a runtime architecture, not a public-API break" has precedent in the React Native ecosystem — `react-native-mmkv` v3 is the New Architecture line, `react-native-mmkv` v4 is the Nitro Modules line. Consumers pick the major by their runtime, not by API differences.

## Decision

The major version number of this library tracks the supported Expo SDK lane.

- **`v1.x.x`** — Expo SDK 55 and earlier. iOS 15.1 minimum. `expo-modules-core@^3.x`. Lives on the long-lived `v1` branch.
- **`v2.x.x`** — Expo SDK 56 and higher. iOS 16.4 minimum. `expo-modules-core@^4.x`. Lives on `main`.
- **`v3.x.x` and beyond** — future SDK-lane bumps.

Both `v1.x.x` and `v2.x.x` ship the full feature set planned for v1 (App Remote SDK wrapping, namespaced API, hooks). Public API is intentionally identical between the two lanes.

The two branches are developed **independently**. There is no lowest-common-denominator rule — each branch uses its SDK lane's full stack (e.g. v2 / main can use SDK 56's new JSI layer and Kotlin compiler plugin freely). Fixes are not auto-ported; the maintainer applies them to each branch as needed.

Each branch has its own pinned example app in `example/` — the v1 branch's example pins to Expo SDK 55, the main branch's example pins to Expo SDK 56.

The deprecation date for `v1.x.x` is **not set**. The maintainer reviews periodically and converts to "bug-fix only" or fully archives when the maintenance cost exceeds the consumer value. This is explicitly a reversible posture — the maintainer can drop the v1 lane at any future point without breaking the versioning scheme.

## Consequences

### Positive

- SDK 55 consumers get App Remote without forcing a runtime upgrade.
- Each branch uses the best of its SDK lane — no LCD constraint dragging modern branches down.
- Major version number gives consumers an immediately-readable signal of which SDK lane to install. README states: "`v1.x` for Expo SDK 55, `v2.x` for SDK 56+."
- Reversible: the maintainer can later freeze v1 / archive v1 / drop SDK 55 entirely without breaking the convention. Future v3 = SDK 57+ slot is open.

### Negative

- Two test matrices, two CI configs, two example apps, two podspec / dev-dep configs.
- Bug fixes don't auto-port — every fix is two PRs or two cherry-picks. Risk of one branch quietly drifting (gets a fix the other doesn't).
- Semver expectations are mildly subverted: a major bump signals "runtime change", not "API break". Documented in the README so consumers don't misread it.
- Consumer discovery: someone landing on the npm page sees the latest version (v2.x) and may not realise v1.x is still maintained. README and the npm `keywords` mention both lanes.

### Neutral

- Public API parity between lanes is a **policy commitment**, not an enforced invariant. The maintainer applies discipline; future tooling could check parity automatically but isn't required for v1.

## Implementation

The branch cut and SDK 56 migration happen **after** all v1.0.0 feature work is complete on `main` (still on SDK 55) — see [V1_PLAN.md §6 Phases 6–7](../V1_PLAN.md#6-implementation-phases). This avoids doing the App Remote work twice.

| Step | Where | When |
| --- | --- | --- |
| Develop App Remote + namespacing on `main` while it is still on Expo SDK 55 | `main` | Phases 1–6 |
| Tag `v1.0.0` on `main` | `main` | End of Phase 6 |
| Cut `v1` branch from the `v1.0.0` tag | git, branch `v1` | Immediately after tag |
| `release-please-config.json` on `v1` configured to release `v1.x.y` from `v1` branch | `v1` | Immediately after branch cut |
| Bump `main` to SDK 56: `ios/ExpoSpotifySDK.podspec` → `:ios, '16.4'`; `package.json` dev deps → `^56`; `example/` pinned to SDK 56 | `main` | Phase 7 |
| Bump `package.json` version on `main` to `2.0.0` | `main` | Phase 7 |
| Export typed config plugin at `@wwdrew/expo-spotify-sdk/plugin` (SDK 56 pattern) | `main` only | Phase 7 — not on `v1` |
| README on both branches documents the lane → version mapping prominently | both | Phases 6 (main / v1) and 7 (main) |
| CHANGELOG entries reference the lane (`v1.0.0 — Expo SDK 55 lane`, `v2.0.0 — Expo SDK 56 lane`) | both | At release |
| GitHub Actions runs per branch with the appropriate Xcode / Android SDK matrix | `.github/workflows/` per branch | Phase 7 (main migration); pre-existing on `v1` |
| Tag `v2.0.0` on `main` | `main` | End of Phase 7 |

## Validation

Not applicable until both branches are cut and a first synchronised release happens. Validation will be:

1. Install v1.x in an Expo SDK 55 app — `npx expo prebuild` succeeds, App Remote calls work.
2. Install v2.x in an Expo SDK 56 app — same, with SDK 56's faster build.
3. Install v1.x in an Expo SDK 56 app — pod resolution warns or fails (expected); README directs the consumer to v2.x.
4. Install v2.x in an Expo SDK 55 app — pod resolution fails (`expo-modules-core@^4` requires iOS 16.4 which the app's other deps can't satisfy); README directs the consumer to v1.x.
