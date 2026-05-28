# Manual QA checklist — v1.0.0 (Expo SDK 55 lane)

Run on **real devices** before tagging `v1.0.0`. Sign off each row for iOS and Android.

**Accounts:** at least one **Premium** and one **Free** tester (added under Spotify Dashboard → User Management for Development Mode apps).

**Environment:** Spotify app installed and logged in; for token-swap flows, Expo dev server serving `/swap` and `/refresh` (see [README](../README.md#token-swap-server)).

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

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Tester | | |
| Maintainer | | |
