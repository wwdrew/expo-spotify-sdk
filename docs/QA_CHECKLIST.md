# Manual QA checklist

Run on **real devices** before a release. Use the checklist that matches your **branch and Expo SDK**, not both for every release.

| Release | Branch | Expo SDK | When to use |
| --- | --- | --- | --- |
| **`2.x`** | `main` | 56+ | Before merging a Release Please PR on `main` |
| **`1.x`** | `v1` | 55 | Before publishing a maintenance release from `v1` |

**Accounts:** at least one **Premium** and one **Free** tester (Spotify Dashboard → User Management for Development Mode apps).

**Environment:** Spotify app installed and logged in; for token-swap flows, Expo dev server serving `/swap` and `/refresh` (see [README](../README.md#token-swap-server)).

**Setup:**

```sh
# SDK 56 (2.x) — default
git checkout main && yarn install
cd example && yarn install && cd ..
npx expo prebuild   # if native projects changed

# SDK 55 (1.x) — maintenance lane only
git checkout v1 && yarn install
cd example && yarn install && cd ..
npx expo prebuild
```

When QAing a **published npm version** (not a git checkout), install from npm — native SDKs resolve at build time (CocoaPods / Gradle).

On **`main`**, you can also exercise the **typed config plugin** in `app.config.ts` (`import { withSpotifySdk } from "@wwdrew/expo-spotify-sdk/plugin"`). That path is not on `v1`.

---

## Auth

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| A1 | `Auth.isAvailable()` is `true` with Spotify installed | ☐ | ☐ |
| A2 | `Auth.authenticate()` succeeds (code + swap URLs) | ☐ | ☐ |
| A3 | `Auth.authenticate()` without swap (TOKEN flow) — note refresh token behavior | ☐ | ☐ |
| A4 | `Auth.refresh()` renews session when refresh token present | ☐ | ☐ |
| A5 | Cancel auth → `USER_CANCELLED`, no stuck `AUTH_IN_PROGRESS` after `Auth.cancelPending()` | ☐ | ☐ |
| A6 | `Auth.addListener("sessionChange")` fires `didInitiate` / `didFail` | ☐ | ☐ |

## App Remote

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| R1 | `AppRemote.connect()` succeeds with Spotify **foreground** | ☐ | ☐ |
| R2 | `connectionStateChange` → `connected`; hooks update | ☐ | ☐ |
| R3 | `AppRemote.disconnect()` returns to `disconnected` | ☐ | ☐ |
| R4 | Connect with Spotify backgrounded — graceful failure, no infinite retry loop | ☐ | ☐ |
| R5 | `connectionError` surfaced on failure / drop | ☐ | ☐ |
| R6 | `authorizeAndPlay()` recovers when Spotify suspended (iOS) | ☐ | ☐ |

## Player (Premium account)

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| P1 | Now playing shows track title / artist via hooks | ☐ | ☐ |
| P2 | Play / pause / skip next / skip previous | ☐ | ☐ |
| P3 | `Player.play(uri)` starts requested track | ☐ | ☐ |
| P4 | `Player.*` before connect → `NOT_CONNECTED` | ☐ | ☐ |

## Player / capabilities (Free account)

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| F1 | `useCapabilities().canPlayOnDemand === false` | ☐ | ☐ |
| F2 | `Player.play()` may reject with `PREMIUM_REQUIRED` | ☐ | ☐ |
| F3 | Metadata may be empty or limited (documented platform behavior) | ☐ | ☐ |

## User

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| U1 | Save / unsave current track via `User.addToLibrary` / `removeFromLibrary` | ☐ | ☐ |
| U2 | `useLibraryState(uri)` reflects save state | ☐ | ☐ |

## Content + Images

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| C1 | Load recommended content; open container children | ☐ | ☐ |
| C2 | `Images.load()` returns local `uri` for artwork | ☐ | ☐ |

## Example app

| # | Test | iOS | Android |
| --- | --- | --- | --- |
| E1 | Full flow: connect → App Remote → now playing → browse | ☐ | ☐ |
| E2 | Account tier label matches `/v1/me` `product` | ☐ | ☐ |
| E3 | Errors show `[namespace] code: message` in UI | ☐ | ☐ |
| E4 | **`main` only:** `withSpotifySdk` in `app.config.ts` prebuilds without errors | ☐ | ☐ |

## Sign-off

| Release | Branch | Tester | Date |
| --- | --- | --- | --- |
| `2.x` | `main` | | |
| `1.x` | `v1` | | |
