# v1/v2 plan — App Remote + namespaced API

Plan for getting `@wwdrew/expo-spotify-sdk` from its current auth-only `0.8.x` state to a feature-complete native-SDK wrapper covering both halves of Spotify's mobile SDKs: the **Auth SDK** (today) and the **App Remote SDK** (new).

**Status:** Phase 7 in progress on `main` (SDK 56 → `2.0.0`). Phase 6 complete; `v1.0.0` shipped on the `v1` branch (SDK 55). Source of truth for per-method status: the [Coverage matrix](#5-coverage-matrix). Remaining: manual QA on SDK 56, tag `v2.0.0` — see [RELEASE.md](./RELEASE.md) (update for v2 when ready).

**Related:** [CONTEXT.md](../CONTEXT.md) (terminology), [ADR-0004](./adr/0004-no-web-api-wrapper.md), [ADR-0005](./adr/0005-sdk-lane-versioning.md), [ADR-0006](./adr/0006-namespaced-api-and-app-remote-scope.md).

---

## 1. Vision

| Pillar | v1 / v2 target |
| --- | --- |
| **Scope** | The **entire native-SDK surface** of Spotify's iOS and Android SDKs — Auth + every documented App Remote API. |
| **Not scope** | Spotify Web API (`api.spotify.com`), Spotify Connect device transfer, Web Playback SDK. See [ADR-0004](./adr/0004-no-web-api-wrapper.md). |
| **Platforms** | iOS, Android. No web. |
| **Public API** | Six namespaces mirroring the SDK split: `Auth`, `AppRemote`, `Player`, `User`, `Content`, `Images` + React hooks. |
| **Errors** | Per-namespace `SpotifyError` subclasses (`AuthError`, `AppRemoteError`, `PlayerError`, `UserError`, `ContentError`, `ImagesError`) — never silent failure. |
| **SDK lane** | `v1.x.x` ships on Expo SDK 55 (iOS 15.1+). `v2.x.x` ships on Expo SDK 56+ (iOS 16.4+). Both lanes ship the full feature set. See [ADR-0005](./adr/0005-sdk-lane-versioning.md). |

**North star:** A consumer can integrate Spotify auth + playback control in an Expo / React Native app without writing any native code or learning the underlying SDK's classes.

**Not a goal:** Wrapping `api.spotify.com`. Consumers hold the access token from `Auth.authenticate` and call REST themselves.

---

## 2. What exists today (baseline)

**Current release (pending tag):** `2.0.0` on `main` (Expo SDK 56). `1.x` is maintained on the `v1` branch (SDK 55).

| Domain | Public API | iOS | Android |
| --- | --- | --- | --- |
| Auth | `Auth.*` (+ deprecated v0 shims) | ✅ | ✅ |
| App Remote | `AppRemote`, `Player`, `User`, `Content`, `Images`, hooks | ✅ | ✅ |

**Public API shape:** Flat top-level functions exported from `src/index.ts`. Single `SpotifyError` class with `SpotifyErrorCode` union of 9 codes.

---

## 3. Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  TypeScript public API (6 namespaces + hooks)                │
│  Auth · AppRemote · Player · User · Content · Images         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  expo-module bridge (AsyncFunction per method, Events per    │
│  subscription stream)                                        │
└─────────────┬───────────────────────────────┬─────────────────┘
              │                               │
   ┌──────────▼──────────┐         ┌──────────▼──────────┐
   │  iOS                 │         │  Android             │
   │  Auth: SPTSessionMgr │         │  Auth: AuthSDK 4.0.1 │
   │  Remote: SpotifyApp- │         │  Remote: spotify-    │
   │          Remote 5.x  │         │          android-    │
   │                      │         │          app-remote  │
   └─────────────────────┘         └─────────────────────┘
              │                               │
              └───────────┬───────────────────┘
                          ▼
              (No HTTP. No api.spotify.com.)
```

### Layers

| Layer | Responsibility |
| --- | --- |
| `src/auth/` | `Auth` namespace + types + `AuthError` |
| `src/app-remote/` | `AppRemote` namespace + `ConnectionState` types + `AppRemoteError` |
| `src/player/` | `Player` namespace + `PlayerState` types + `PlayerError` |
| `src/user/` | `User` namespace + `Capabilities` / `LibraryState` types + `UserError` |
| `src/content/` | `Content` namespace + `ContentItem` types + `ContentError` |
| `src/images/` | `Images` namespace + `ImagesError` |
| `src/hooks/` | React hooks (`useSession`, `useConnectionState`, `usePlayerState`, derived helpers) built on `useSyncExternalStore` |
| `src/uri/` | `SpotifyURI` branded type + helpers |
| `src/error.ts` | Abstract `SpotifyError` base class |
| Native (iOS) | Swift modules per namespace; `SpotifyAppRemoteCoordinator` actor mirroring `SpotifyAuthCoordinator` |
| Native (Android) | Kotlin modules per namespace |

---

## 4. Public API surface

### Namespaces

```ts
import {
  Auth, AppRemote, Player, User, Content, Images,
  SpotifyURI,
  SpotifyError, AuthError, AppRemoteError, PlayerError,
  UserError, ContentError, ImagesError,
} from "@wwdrew/expo-spotify-sdk";

import {
  useSession, useConnectionState, usePlayerState,
  useCurrentTrack, useIsPlaying, usePlaybackPosition,
  useCapabilities, useLibraryState,
} from "@wwdrew/expo-spotify-sdk";
```

### Full method list

**`Auth`** (replaces all v0.x top-level functions)

| Method | Returns |
| --- | --- |
| `Auth.isAvailable()` | `boolean` |
| `Auth.authenticate(config: AuthenticateConfig)` | `Promise<SpotifySession>` |
| `Auth.refresh(config: RefreshConfig)` | `Promise<SpotifySession>` |
| `Auth.cancelPending()` | `Promise<void>` |
| `Auth.addListener("sessionChange", cb)` | `Subscription` |

**`AppRemote`** (connection lifecycle)

| Method | Returns |
| --- | --- |
| `AppRemote.connect(accessToken, options?)` | `Promise<void>` |
| `AppRemote.disconnect()` | `Promise<void>` |
| `AppRemote.isConnected()` | `boolean` |
| `AppRemote.getConnectionState()` | `ConnectionState` |
| `AppRemote.addListener("connectionStateChange", cb)` | `Subscription` |
| `AppRemote.addListener("connectionError", cb)` | `Subscription` |

**`Player`** (transport + queue + state)

| Method | Returns |
| --- | --- |
| `Player.play(uri: SpotifyURI)` | `Promise<void>` |
| `Player.pause()` | `Promise<void>` |
| `Player.resume()` | `Promise<void>` |
| `Player.skipNext()` | `Promise<void>` |
| `Player.skipPrevious()` | `Promise<void>` |
| `Player.seekTo(positionMs: number)` | `Promise<void>` |
| `Player.setShuffle(enabled: boolean)` | `Promise<void>` |
| `Player.setRepeatMode(mode: RepeatMode)` | `Promise<void>` |
| `Player.setPodcastPlaybackSpeed(speed: PodcastPlaybackSpeed)` | `Promise<void>` |
| `Player.queue(uri: SpotifyURI)` | `Promise<void>` |
| `Player.getPlayerState()` | `Promise<PlayerState>` |
| `Player.getCrossfadeState()` | `Promise<CrossfadeState>` |
| `Player.addListener("playerStateChange", cb)` | `Subscription` |

**`User`** (capabilities + per-URI library state + saves)

| Method | Returns |
| --- | --- |
| `User.getCapabilities()` | `Promise<Capabilities>` |
| `User.getLibraryState(uri: SpotifyURI)` | `Promise<LibraryState>` |
| `User.addToLibrary(uri: SpotifyURI)` | `Promise<void>` |
| `User.removeFromLibrary(uri: SpotifyURI)` | `Promise<void>` |
| `User.addListener("capabilitiesChange", cb)` | `Subscription` |
| `User.addLibraryStateListener(uri: SpotifyURI, cb)` | `Subscription` |

**`Content`** (Spotify-curated browse tree)

| Method | Returns |
| --- | --- |
| `Content.getRecommendedContentItems(type: ContentType)` | `Promise<ContentItem[]>` |
| `Content.getChildren(item: ContentItem)` | `Promise<ContentItem[]>` |

**`Images`** (cover art)

| Method | Returns |
| --- | --- |
| `Images.load(item: ImageRepresentable, size)` | `Promise<{ uri: string }>` (file URI) |

### Hooks

| Hook | Returns | Source |
| --- | --- | --- |
| `useSession()` | `SpotifySession \| null` | `Auth.addListener("sessionChange", ...)` |
| `useConnectionState()` | `ConnectionState` | `AppRemote.addListener("connectionStateChange", ...)` |
| `usePlayerState()` | `PlayerState \| null` | `Player.addListener("playerStateChange", ...)` |
| `useCurrentTrack()` | `Track \| null` | derived from `usePlayerState` |
| `useIsPlaying()` | `boolean` | derived from `usePlayerState` |
| `usePlaybackPosition()` | `number` (ms, ticks ~250ms while playing) | derived from `usePlayerState` |
| `useCapabilities()` | `Capabilities \| null` | `User.addListener("capabilitiesChange", ...)` |
| `useLibraryState(uri: SpotifyURI)` | `LibraryState \| null` | `User.addLibraryStateListener(uri, ...)` |

All hooks built on `useSyncExternalStore` for correct tearing-free behaviour.

### `SpotifyURI`

```ts
type SpotifyURI = string & { readonly __brand: 'SpotifyURI' };
type SpotifyResourceType = 'track' | 'album' | 'playlist' | 'artist' | 'show' | 'episode';

const SpotifyURI = {
  from(uri: string): SpotifyURI,       // validates, throws on invalid
  unsafe(uri: string): SpotifyURI,     // skip validation
  parse(uri: SpotifyURI): { type: SpotifyResourceType; id: string },
  build(type: SpotifyResourceType, id: string): SpotifyURI,
  isValid(uri: string): uri is SpotifyURI,
};
```

---

## 5. Coverage matrix

Legend: ✅ shipped · 🟡 in progress · ⬜ not started · ➖ N/A on this platform

### 5.1 Auth

| Method | iOS | Android |
| --- | --- | --- |
| `Auth.isAvailable()` | ✅ | ✅ |
| `Auth.authenticate()` | ✅ | ✅ |
| `Auth.refresh()` | ✅ | ✅ |
| `Auth.cancelPending()` | ✅ | ➖ (no-op) |
| `Auth.addListener("sessionChange", ...)` | ✅ | ✅ |

### 5.2 AppRemote

| Method | iOS | Android |
| --- | --- | --- |
| `AppRemote.connect()` | ✅ | ✅ |
| `AppRemote.disconnect()` | ✅ | ✅ |
| `AppRemote.isConnected()` | ✅ | ✅ |
| `AppRemote.getConnectionState()` | ✅ | ✅ |
| `addListener("connectionStateChange", ...)` | ✅ | ✅ |
| `addListener("connectionError", ...)` | ✅ | ✅ |

### 5.3 Player

| Method | iOS | Android |
| --- | --- | --- |
| `Player.play()` | ✅ | ✅ |
| `Player.pause()` / `resume()` | ✅ | ✅ |
| `Player.skipNext()` / `skipPrevious()` | ✅ | ✅ |
| `Player.seekTo()` | ✅ | ✅ |
| `Player.setShuffle()` / `setRepeatMode()` | ✅ | ✅ |
| `Player.setPodcastPlaybackSpeed()` | ✅ | ✅ |
| `Player.queue()` | ✅ | ✅ |
| `Player.getPlayerState()` | ✅ | ✅ |
| `Player.getCrossfadeState()` | ✅ | ✅ |
| `addListener("playerStateChange", ...)` | ✅ | ✅ |

### 5.4 User

| Method | iOS | Android |
| --- | --- | --- |
| `User.getCapabilities()` | ✅ | ✅ |
| `User.getLibraryState()` | ✅ | ✅ |
| `User.addToLibrary()` / `removeFromLibrary()` | ✅ | ✅ |
| `addListener("capabilitiesChange", ...)` | ✅ | ✅ |
| `addLibraryStateListener(uri, ...)` | ✅ | ✅ |

### 5.5 Content

| Method | iOS | Android |
| --- | --- | --- |
| `Content.getRecommendedContentItems()` | ✅ | ✅ |
| `Content.getChildren()` | ✅ | ✅ |

### 5.6 Images

| Method | iOS | Android |
| --- | --- | --- |
| `Images.load()` | ✅ | ✅ |

### 5.7 Hooks (TypeScript-only; no native work)

| Hook | Status |
| --- | --- |
| All hooks listed in §4 | ✅ |

---

## 6. Implementation phases

Ordered for vertical slices (each phase produces something demoable on device) and dependency order (foundation → connection → player → polish → branch cut → SDK 56 migration).

**Development sequence:** All App Remote work (Phases 1–6) happens on `main` while `main` is still on Expo SDK 55 — the same toolchain `0.8.x` ships on today. Only after v1.0.0 is feature-complete and tagged on `main` do we cut the `v1` branch (as the long-lived SDK 55 lane) and then migrate `main` itself to SDK 56 in Phase 7 to become the v2.0.0 line. This avoids doing the App Remote work twice (once per SDK lane); the SDK 56 migration is then a focused, isolated change on top of a known-good v1.0.0.

### Phase 0 — Repo & doc setup (no branch cuts, no SDK bumps yet)

| Task | Deliverable |
| --- | --- |
| `CONTEXT.md` | ✅ (this PR) |
| ADRs 0004/0005/0006 | ✅ (this PR) |
| `V1_PLAN.md` | ✅ (this PR) |
| CI on `main` extended to cover the new namespace structure | GitHub Actions matrix still on SDK 55 |

**Exit:** Docs published on `main`. No branch or SDK changes — `main` continues to ship `0.8.x`-compatible builds while Phases 1–6 progress on it.

### Phase 1 — Foundation: error classes, URI type, namespace skeleton

| Task | Deliverable |
| --- | --- |
| `src/error.ts` | Abstract `SpotifyError` base class |
| Per-namespace error classes | `AuthError`, `AppRemoteError`, `PlayerError`, `UserError`, `ContentError`, `ImagesError` |
| `src/uri/` | Branded `SpotifyURI` type + helpers |
| Empty namespace stubs | `Auth`, `AppRemote`, `Player`, `User`, `Content`, `Images` exported from `src/index.ts` |
| iOS exception subclasses per namespace | Following the ADR-0003 pattern for each new error class |
| Android `CodedException` subclasses per namespace | Same |
| Migration of existing auth functions | `authenticateAsync` → `Auth.authenticate`, etc. — TS shim only at first; bridge unchanged |

**Exit:** `Auth.authenticate(...)` works identically to `authenticateAsync(...)` on both platforms; all existing 0.8.x tests pass after rename.

### Phase 2 — App Remote: connection lifecycle

| Task | Deliverable |
| --- | --- |
| iOS `SpotifyAppRemoteCoordinator` actor | Mirrors `SpotifyAuthCoordinator`; holds `SPTAppRemote` singleton; manages connection state |
| Android `SpotifyAppRemoteCoordinator` | Same model in Kotlin |
| `AppRemote.connect` / `disconnect` / `isConnected` / `getConnectionState` | All four methods + connection state subscription |
| `AppRemote.addListener("connectionStateChange", ...)` | Native → JS event stream |
| `AppRemote.addListener("connectionError", ...)` | Native → JS event stream |
| `useConnectionState` hook | Built on `useSyncExternalStore` |
| `requireConnected(callsite)` internal helper | Throws `AppRemoteError("NOT_CONNECTED", ...)` with call-site name |

**Exit:** Example app can connect / disconnect to a running Spotify app on both platforms; connection state changes propagate to a hook-driven UI banner.

### Phase 3 — Player: transport + state

| Task | Deliverable |
| --- | --- |
| All `Player.*` transport methods | `play`, `pause`, `resume`, `skipNext`, `skipPrevious`, `seekTo`, `setShuffle`, `setRepeatMode`, `setPodcastPlaybackSpeed`, `queue` |
| `Player.getPlayerState()` / `getCrossfadeState()` | One-shot pull |
| `Player.addListener("playerStateChange", ...)` | Native → JS event stream |
| `usePlayerState` hook + `useCurrentTrack`, `useIsPlaying`, `usePlaybackPosition` derived hooks | Built on `useSyncExternalStore` |
| `PREMIUM_REQUIRED` normalization | iOS and Android error mappers detect Spotify's "can't play on demand" rejection and surface as `PlayerError("PREMIUM_REQUIRED", ...)` |

**Exit:** Example app's "Now Playing" screen reflects the running Spotify app's state in real time; transport buttons work for Premium users; non-Premium users get a `PREMIUM_REQUIRED` error from `Player.play`.

### Phase 4 — User: capabilities + library state

| Task | Deliverable |
| --- | --- |
| `User.getCapabilities()` + subscription | + `useCapabilities` hook |
| `User.getLibraryState(uri)` + per-URI subscription | + `useLibraryState(uri)` hook |
| `User.addToLibrary` / `removeFromLibrary` | Library state push fires automatically |

**Exit:** Example app shows a "save" button on the now-playing screen wired to `useLibraryState`; gated by `useCapabilities().canPlayOnDemand`.

### Phase 5 — Content + Images

| Task | Deliverable |
| --- | --- |
| `Content.getRecommendedContentItems()` / `getChildren()` | Recursive content browsing |
| `Images.load()` | Bitmap fetch → temp file → return `{ uri }` |
| `ImageRepresentable` typing | Union of `Track`, `Album`, `Artist`, `ContentItem` |

**Exit:** Example app has a "Browse" screen that walks the recommended content tree with cover art images.

### Phase 6 — v1.0.0 hardening (still on `main`, still on SDK 55)

| Task | Deliverable | Status |
| --- | --- | --- |
| Error normalization audit | Every native code path that can fail returns the right `*Error` subclass and code | ✅ |
| README rewrite | New API surface, migration table, auto-connect hook recipe, Premium doc, error reference, SDK lanes | ✅ |
| Documentation of every error code | Per `*ErrorCode` entry: when + what to do in README | ✅ |
| Example app polish | Save button gated by capabilities, structured error UI, a11y labels | ✅ |
| Cross-platform parity audit | Documented in README § Platform differences | ✅ |
| Manual QA on real devices | [QA_CHECKLIST.md](./QA_CHECKLIST.md) | ✅ maintainer |
| Tag `v1.0.0` on `main` | [RELEASE.md](./RELEASE.md) | ✅ maintainer |
| Cut `v1` branch from tag | `release-please` → `v1.x.y` from `v1` | ✅ maintainer |

**Exit:** `v1.0.0` is shipped on npm, the `v1` branch exists and is set up for `v1.x.y` releases. `main` is now free to migrate to SDK 56 in Phase 7.

### Phase 7 — Migrate `main` to Expo SDK 56 (v2.0.0)

| Task | Deliverable | Status |
| --- | --- | --- |
| Bump `ios/ExpoSpotifySDK.podspec` deployment target → `:ios, '16.4'` | Required by `expo-modules-core@^56` | ✅ |
| Bump `package.json` dev deps to SDK 56 lane (`@expo/config-plugins@^56`, `expo-module-scripts@^56`, `expo-modules-core@^56`) | | ✅ |
| Bump `example/` Expo SDK to 56 | New dev build / prebuild; verify on both platforms | ✅ |
| Bump Android `compileSdkVersion` / `targetSdkVersion` if Expo SDK 56 requires | Fallbacks → 36 | ✅ |
| Adopt SDK 56–only API surface where it pays off | Optional JSI / Kotlin compiler plugin | — skipped (inherits SDK 56 runtime gains) |
| **Typed config plugin** (`@wwdrew/expo-spotify-sdk/plugin`) | Typed tuple helper + string/tuple backward compat | ✅ |
| Update README on `main` to say "v2.x for SDK 56+; see v1.x for SDK 55" | Lane → version mapping | ✅ |
| Bump `package.json` version → `2.0.0` | | ✅ |
| Run full QA pass on SDK 56 toolchain | Same checklist as Phase 6, this time on SDK 56 | ⬜ maintainer |
| Tag `v2.0.0` on `main` | Release on the SDK 56 toolchain | ⬜ maintainer |

**Exit:** `v2.0.0` is shipped on npm. Both lanes are now live: `v1.x` (on `v1` branch, SDK 55) and `v2.x` (on `main`, SDK 56+). Future feature work happens on `main` first; backporting to `v1` is at the maintainer's discretion per [ADR-0005](./adr/0005-sdk-lane-versioning.md).

---

## 7. Error code reference

### `AuthErrorCode`

`USER_CANCELLED` · `AUTH_IN_PROGRESS` · `INVALID_CONFIG` · `NETWORK_ERROR` · `TOKEN_SWAP_FAILED` · `TOKEN_SWAP_PARSE_ERROR` · `SPOTIFY_NOT_INSTALLED` · `AUTH_ERROR` · `UNKNOWN`

(Carried forward unchanged from v0.x `SpotifyErrorCode`.)

### `AppRemoteErrorCode`

| Code | When |
| --- | --- |
| `CONNECTION_FAILED` | `connect()` failed (Spotify app missing, refused, IPC handshake failed). |
| `CONNECTION_LOST` | Established connection dropped (token expired, Spotify app killed). |
| `NOT_CONNECTED` | Method called requiring a connection (caught here when from `AppRemote.*` itself, mirrored into other namespaces' codes). |
| `UNKNOWN` | Anything else. |

### `PlayerErrorCode`

| Code | When |
| --- | --- |
| `NOT_CONNECTED` | Any `Player.*` call before `AppRemote.connect()` resolved. |
| `CONNECTION_LOST` | Connection dropped mid-call. |
| `PREMIUM_REQUIRED` | Spotify rejected because `canPlayOnDemand === false`. |
| `INVALID_URI` | `SpotifyURI` failed validation at the native boundary. |
| `INVALID_PARAMETER` | Out-of-range arg (negative seek, bad enum value). |
| `OPERATION_NOT_ALLOWED` | Player restriction blocks the call (e.g. `skipNext` when restriction says no). |
| `UNKNOWN` | Anything else. |

### `UserErrorCode`

| Code | When |
| --- | --- |
| `NOT_CONNECTED` | Any `User.*` call before `AppRemote.connect()` resolved. |
| `CONNECTION_LOST` | Connection dropped mid-call. |
| `INVALID_URI` | Bad URI argument. |
| `OPERATION_NOT_ALLOWED` | Library mutation blocked (e.g. Free user, region restriction). |
| `UNKNOWN` | Anything else. |

### `ContentErrorCode`

| Code | When |
| --- | --- |
| `NOT_CONNECTED` | Any `Content.*` call before `AppRemote.connect()` resolved. |
| `CONNECTION_LOST` | Connection dropped mid-call. |
| `CONTENT_API_UNAVAILABLE` | Older Spotify app version doesn't support the Content API call. |
| `UNKNOWN` | Anything else. |

### `ImagesErrorCode`

| Code | When |
| --- | --- |
| `NOT_CONNECTED` | `Images.load()` before connect. |
| `INVALID_URI` | The `ImageRepresentable` doesn't have a loadable image. |
| `IMAGE_LOAD_FAILED` | Spotify rejected the image request, or temp-file write failed. |
| `UNKNOWN` | Anything else. |

---

## 8. Migration from v0.x

The breaking change is a mechanical rename. v0.x consumers should be able to migrate with grep+sed.

| v0.x (top-level) | v1/v2 (namespaced) |
| --- | --- |
| `isAvailable()` | `Auth.isAvailable()` |
| `authenticateAsync(config)` | `Auth.authenticate(config)` |
| `refreshSessionAsync(config)` | `Auth.refresh(config)` |
| `cancelPendingAuthAsync()` | `Auth.cancelPending()` |
| `addSessionChangeListener(cb)` | `Auth.addListener("sessionChange", cb)` |
| `SpotifyError` | `SpotifyError` (abstract) **or** `AuthError` (concrete for auth-thrown ones) |
| `SpotifyErrorCode` | `AuthErrorCode` |

The `SpotifySession` shape, `SpotifyScope`, `SpotifyConfig`, `SpotifyRefreshConfig`, `SpotifySessionChangeEvent` types are unchanged.

**Important type-narrowing change:** v0.x callers doing `if (e instanceof SpotifyError && e.code === 'USER_CANCELLED')` need to switch to `if (e instanceof AuthError && e.code === 'USER_CANCELLED')` — `SpotifyError` is now an abstract base. `instanceof SpotifyError` still works as a catch-all but doesn't narrow `code` to a known union.

---

## 9. v1.0.0 / v2.0.0 release criteria

All required before tagging either major:

- [x] Phase 0–6 code/docs complete on `main` (SDK 55).
- [x] Coverage matrix: every method `✅` on iOS and Android.
- [x] Example app demonstrates Auth, AppRemote, Player transport, hooks, User save gated by capabilities, Content browse with images.
- [x] README rewritten with new API + migration table + auto-connect recipe.
- [x] Every error code has documented "when" and "what to do" in the README.
- [x] [ATTRIBUTION.md](../ATTRIBUTION.md) reflects no Web API wrapping intent.
- [ ] Manual QA on real devices, Premium and Free accounts ([checklist](./QA_CHECKLIST.md)).
- [ ] Tag `v1.0.0` and cut `v1` branch ([release steps](./RELEASE.md)).

**Semver after v1 / v2:**

- **`1.x` / `2.x`** — additive methods, new error codes, new hooks. No removal of public exports without next major bump.
- **Future majors** track Expo SDK lane bumps (v3 = SDK 57+, etc.) — see [ADR-0005](./adr/0005-sdk-lane-versioning.md).

---

## 10. Non-goals

| Item | Reason |
| --- | --- |
| Wrapping Spotify Web API | [ADR-0004](./adr/0004-no-web-api-wrapper.md). Spotify is tightening Web API access. |
| Spotify Connect device transfer | Web API only. |
| Web Playback SDK | No web platform. |
| In-app audio playback | Spotify's model is remote-control of the Spotify app. No exceptions. |
| Apple Music–style "complete client" facade | Spotify is fundamentally a remote-control + bring-your-own-Web-API model. Don't paper over the architectural difference. |

---

## 11. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| App Remote connection lifecycle is flaky in practice (token expiry, Spotify app being killed by OS) | Explicit `connect()` model + clear `CONNECTION_LOST` error code; example app demonstrates reconnect flow. |
| Premium-required errors are surfaced inconsistently by the SDKs across iOS/Android | Mapper layer per platform normalises to `PREMIUM_REQUIRED`. Document iOS vs Android error-shape differences in error code reference. |
| Maintaining two SDK lanes in parallel becomes too expensive | Deprecation date for v1 (SDK 55) is left open; can convert to "bug-fix only" at any time. |
| Spotify ships an SDK update that breaks the bundled xcframework / AAR | Already on ADR-0001 build-time download model; pin the SDK version and bump deliberately. |
| Spotify Web API tightening makes consumers expect this library to fill the gap | Document the no-Web-API policy prominently. Point consumers at the access token + their own `fetch`. |

---

## 12. Open questions (to revisit during implementation)

- Exact shape of `PlayerState` (which native fields pass through, which get renamed/reshaped) — drafted from iOS `SPTAppRemotePlayerState` headers in Phase 3.
- Exact shape of `Capabilities` and `LibraryState` — drafted from iOS `SPTAppRemoteUserCapabilities` / `SPTAppRemoteLibraryState` in Phase 4.
- Exact shape of `ContentItem` recursion (children always known, or lazily fetched per call?) — drafted in Phase 5.
- `Images.load()` cache strategy — naive temp-file write per call vs cache by URI+size. Default to naive in v1, revisit if size becomes a problem.
- Whether `connect()` should accept a `refreshFn` callback for SDK-side auto-reconnect on token expiry — out of scope for v1 (consumer handles it), revisit later if it becomes a frequent ask.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Initial v1/v2 plan |
