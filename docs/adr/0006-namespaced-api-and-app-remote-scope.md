# ADR-0006: Namespaced API and full App Remote SDK scope

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** @wwdrew

## Context

`@wwdrew/expo-spotify-sdk@0.8.0` exposes a flat top-level API:

```ts
import {
  isAvailable,
  authenticateAsync,
  cancelPendingAuthAsync,
  refreshSessionAsync,
  addSessionChangeListener,
  SpotifyError,
} from "@wwdrew/expo-spotify-sdk";
```

Five functions, one error class, one event subscription. This shape worked for an auth-only library.

The library is now adding wrappers for the full App Remote SDK (see [V1_PLAN.md](../V1_PLAN.md) for the per-method coverage). App Remote itself decomposes into six native sub-APIs:

| Sub-API | iOS class | What it does |
| --- | --- | --- |
| Connection | `SpotifyAppRemote` itself, `SPTAppRemoteConnectionParams` | Connect / disconnect to the Spotify app, auto-launch, lifecycle events. |
| Player | `SPTAppRemotePlayerAPI` | Transport (`play`, `pause`, `skipNext`, `seek`), queue, shuffle / repeat, playback options. |
| Player state | `SPTAppRemotePlayerState`, `subscribeToPlayerState` | Live snapshot of current track, position, paused, shuffle, repeat, restrictions, crossfade. |
| User | `SPTAppRemoteUserAPI` + `SPTAppRemoteUserCapabilities` + `SPTAppRemoteLibraryState` | User capabilities (`canPlayOnDemand`), library state per URI, `addToLibrary` / `removeFromLibrary`. |
| Content | `SPTAppRemoteContentAPI` | Spotify-curated browse tree (recommended content, navigable as parents / children). |
| Images | `SPTAppRemoteImageAPI` | Cover art bitmap loader. |

The Android `com.spotify.android:app-remote` SDK has equivalents for all six.

That adds ~25 new methods, ~5 new event subscription streams, and a bunch of new types (`PlayerState`, `Capabilities`, `LibraryState`, `ContentItem`, `RepeatMode`, …) to the public surface. Two shape questions follow:

1. **How is the public API structured** — stay top-level (`play`, `pause`, `connect`, `addToLibrary`, …), or namespace it?
2. **Which App Remote sub-APIs do we wrap** — all six, or a subset?

### Options considered for (1)

- **Stay flat.** Add ~25 new top-level exports alongside the existing ones. No breaking change. Backwards-compatible.
- **Namespace fully.** `Auth.authenticate`, `Player.play`, `User.addToLibrary`, ... Six namespaces mirroring the SDK split. Breaking change at the major bump.
- **Hybrid.** Keep top-level auth functions, namespace only the new App Remote stuff. No breaking change but permanent stylistic inconsistency.

### Options considered for (2)

- **Connection + Player + Player state only.** The minimum credible App Remote wrapper. Defer User / Content / Images to point releases.
- **All six.** Wrap every documented App Remote sub-API. No consumer ever drops to native to use a missing feature.
- **Connection + Player + Player state + User + Images (skip Content).** Compromise — Content is the most opinionated and most overlap with what the Spotify app itself shows.

## Decision

### Six namespaces

The public API is split into six namespaces, each named for the underlying SDK area:

```ts
import { Auth, AppRemote, Player, User, Content, Images } from "@wwdrew/expo-spotify-sdk";
```

| Namespace | Wraps |
| --- | --- |
| `Auth` | OAuth (today's top-level functions). |
| `AppRemote` | Connection lifecycle (`connect`, `disconnect`, connection state events). |
| `Player` | Transport, queue, player state subscription. |
| `User` | Capabilities, per-URI library state, saves. |
| `Content` | Curated content browsing. |
| `Images` | Cover art loader. |

The flat top-level functions from v0.x are **removed in `2.x`**, not soft-deprecated. Migration is a mechanical rename — see [V1_PLAN.md §8](../archive/V1_PLAN.md#8-migration-from-v0x). The major bump is the right time to do this; carrying both shapes forever would mean permanent two-stylistic-worlds drift.

> **Amendment (2026-05-30):** `1.0.0` on the SDK 55 lane shipped temporary `@deprecated` v0 shims as a pragmatic upgrade path. **`2.0.0`** on the SDK 56 lane removes them per this decision. The `v1` maintenance branch retains shims until that lane EOLs.

Naming style across namespaces:

- Drop the `Async` suffix from method names. The Promise return type carries the info.
- Subscription methods use a typed-generic `addListener<K extends keyof EventMap>(event, cb)` pattern for type-safe events. The `EventMap` per namespace documents which streams exist.
- Connection-dependent methods (everything in `Player` / `User` / `Content` / `Images`) reject with the namespace's `NOT_CONNECTED` error code if called before `AppRemote.connect()` resolved.

### All six App Remote sub-APIs

v1.0.0 / v2.0.0 wrap **every documented App Remote sub-API**. Partial coverage would leave consumers reaching for native code for any feature we skipped — which defeats the point of having a wrapper at all.

This includes the `Content` and `Images` APIs even though they're the most "data-like" and would be easiest to defer. They are part of App Remote, they're what the SDK ships, and they have no alternative source for the consumer (the Web API exposes catalog / saved-library data but not Spotify's curated content tree or App-Remote-resolved cover art).

## Consequences

### Positive

- Public API mirrors the underlying SDK structure 1:1. A consumer reading Spotify's official docs can map every concept to a namespace in this library.
- Discoverable via IDE autocomplete — typing `Auth.` / `Player.` / etc. surfaces all available methods. No giant flat top-level list.
- Type-safe events through `addListener<K>` keep the JS / native event surface readable.
- No "what's missing?" question — every native sub-API has a wrapper.

### Negative

- Breaking change for every v0.x consumer. Migration is mechanical (rename `authenticateAsync` → `Auth.authenticate`, etc.) but it is breaking.
- More native code to write and maintain — every namespace gets a Swift module, a Kotlin module, an iOS exception subclass, an Android `CodedException` subclass.
- Three new namespaces (`Content`, `Images`, parts of `User`) are less essential than `Player` — the cost to v1 is real even though we believe the benefit justifies it.

### Neutral

- Hooks live as top-level exports (`useSession`, `usePlayerState`, ...), not under their namespace. Idiomatic React hook discoverability outweighs naming consistency with the underlying namespace.

## Implementation

The phased plan (Phase 0 → Phase 6) lives in [V1_PLAN.md §6](../archive/V1_PLAN.md#6-implementation-phases). Highlights:

| Phase | What |
| --- | --- |
| 1 | Foundation: error classes, `SpotifyURI` branded type, namespace skeletons, auth migration. |
| 2 | `AppRemote` connection lifecycle on both platforms. |
| 3 | `Player` transport + player state subscription + hooks. |
| 4 | `User` capabilities + library state. |
| 5 | `Content` + `Images`. |
| 6 | Hardening, README rewrite, example app polish. |

Phases 1–6 landed before the SDK 56 migration; the same API ships on **`v1`** (SDK 55) and **`main`** (SDK 56) per [ADR-0005](./0005-sdk-lane-versioning.md). New API work targets **`main`** first.

## Validation

Per-phase exit criteria in [V1_PLAN.md §6](../archive/V1_PLAN.md#6-implementation-phases). Final release criteria in [V1_PLAN.md §9](../archive/V1_PLAN.md#9-v100--v200-release-criteria) — both v1.0.0 and v2.0.0 require:

- Every method `✅` on iOS and Android in the coverage matrix.
- Example app demonstrating all six namespaces (Auth, AppRemote connect/disconnect, Player transport + now-playing state via hooks, User save gated by capabilities, Content browse, Images load).
- README rewritten with new API + migration table.
- Every error code documented with "when" and "what to do".
- Manual QA on real devices, Premium and Free accounts, both platforms.
