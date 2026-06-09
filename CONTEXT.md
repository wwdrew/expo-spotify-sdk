# Project context — @wwdrew/expo-spotify-sdk

Reference for humans and agents. Use this file to keep terminology straight when talking about the various Spotify SDKs, their relationship to the Spotify Web API, and what this library does (and explicitly does not) wrap.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description` (e.g. `fix(ios): …`, `feat(android): …`, `docs: …`). Use an optional scope when the change is platform- or area-specific.

## Branches

| Branch | npm | Expo SDK | Use for |
| --- | --- | --- | --- |
| **`main`** | `2.x` | 56+ | Default: features, fixes, releases |
| **`v1`** | `1.x` | 55 | Maintenance backports only |

Topic branch names follow conventional-commit prefixes: `feat/*`, `fix/*`, `docs/*`, etc. Open PRs against **`main`** unless you are intentionally targeting the SDK 55 lane (then branch from **`v1`** and merge back to **`v1`**).

## Branch naming

Branch names follow the same `type/` prefix as conventional commits: `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `chore/*`, `test/*`. Examples: `feat/auth-namespace`, `fix/android-token-flow`, `docs/release-v2`.

## Terminology

| Term | Meaning | **Not** this |
| --- | --- | --- |
| **Spotify app** | The official Spotify consumer app installed on the user's device. Performs the actual audio playback for App Remote integrations. | Your app / the host app embedding this library. |
| **Auth SDK** | The OAuth half of the native Spotify SDKs (`SPTSessionManager` on iOS, `com.spotify.android:auth` on Android). Authenticates the user via the installed Spotify app or web fallback and returns an OAuth access token. | A user-data API. It only signs the user in. |
| **App Remote SDK** | The playback-control half of the native Spotify SDKs (`SpotifyAppRemote` on iOS, `com.spotify.android:app-remote` on Android). Connects to the running Spotify app over IPC and remote-controls it: transport, queue, now-playing state, user library state, content browsing, cover art. **Requires Spotify Premium.** | An audio engine. The host app never plays audio itself; the Spotify app does. |
| **Web API** | Spotify's REST API at `https://api.spotify.com/v1`. Catalog, library, recently played, top items, audio features, recommendations, playlist mutations, Connect device transfer. | Part of this library. Consumers call it themselves with the access token from `authenticateAsync`. |
| **Web Playback SDK** | Spotify's browser-only JS SDK that plays audio in the page. | Part of this library. Out of scope (no web platform). |
| **Spotify Connect** | Spotify's protocol for transferring playback between devices (phone, speaker, desktop). Exposed via the Web API (`/me/player/*`), not App Remote. | Wrapped by this library. |
| **Premium** | A paid Spotify subscription. Required by the App Remote SDK to play / control playback. The Auth SDK does not require Premium. | A library concept. We surface Premium-gated failures from the SDK; we don't enforce it ourselves. |
| **Access token** | OAuth bearer token returned by `authenticateAsync`. Consumers pass it to `AppRemote.connect()` and use it to call the Web API themselves. | Persisted by this library. Consumers store and refresh it; the library holds no token state. |
| **Connection** | The live IPC channel between the host app and the Spotify app, established via `AppRemote.connect(accessToken)`. Required before any `Player` / `User` / `Content` / `Images` call. Can drop spontaneously (token expired, Spotify app killed). | A persistent socket. Re-connecting after a drop requires a fresh `connect()` call with a current access token. |
| **Connection state** | One of `disconnected` / `connecting` / `connected`. Pushed via `AppRemote.addConnectionStateListener`. | The auth session state — those are independent (you can be authenticated but disconnected). |
| **Spotify URI** | The Spotify URI scheme — `spotify:track:<id>`, `spotify:album:<id>`, `spotify:playlist:<id>`, `spotify:artist:<id>`, `spotify:show:<id>`, `spotify:episode:<id>`. The universal identifier accepted by `Player.play()`, `User.getLibraryState()`, `User.addToLibrary()`, etc. Surfaced in TypeScript as a branded `SpotifyURI` type — consumers construct via `SpotifyURI.from(str)` (validating) or `SpotifyURI.unsafe(str)` (skipping validation). | An HTTPS URL. Spotify also has `https://open.spotify.com/track/<id>` open-graph URLs; App Remote takes the `spotify:` form. |
| **SpotifyError** | Abstract base class shared by every error thrown by this library. Carries `code` and `namespace` properties. Catch via `instanceof SpotifyError` for "any failure from this library" handling. | A concrete class. Always thrown as one of the per-namespace subclasses (`AuthError`, `AppRemoteError`, `PlayerError`, `UserError`, `ContentError`, `ImagesError`). |
| **Player state** | A snapshot of the Spotify app's current playback: current track + metadata, playback position, paused/playing, shuffle mode, repeat mode, playback restrictions (can skip next? can skip prev? can repeat? can shuffle?), crossfade state, podcast playback speed. Pushed via `Player.addPlayerStateListener`. | The connection state, or the user's capabilities. |
| **Capabilities** | Spotify-side feature flags for the signed-in user. Chiefly `canPlayOnDemand` — `false` for Free-tier users, meaning explicit `Player.play(uri)` calls will fail and only shuffle-play-from-context is allowed. Pushed via `User.addCapabilitiesListener`. | A Premium check. Premium is the underlying cause but `canPlayOnDemand` is what App Remote actually reports. |
| **Library state** | For a given URI, whether it is in the user's saved library (`isAdded`) and whether it can be added (`canAdd`). Pushed via `User.addLibraryStateListener(uri)`. | The user's full saved library. App Remote only reports state for one URI at a time. |
| **Content item** | The browseable unit returned by `Content.getRecommendedContentItems()` — represents a section, playlist, album, or track in Spotify's curated browse tree. Children navigated via `Content.getChildren(item)`. Each item carries an image-representable handle usable with `Images.load()`. | A full catalog object. Content items are a navigation surface, not the Web-API catalog. |

**Rule of thumb:** This library wraps the **Auth SDK** and the **App Remote SDK**. Anything that lives at `api.spotify.com` is the consumer's responsibility — they have the access token, they call REST.

## Native SDK binaries

Spotify native binaries are **not** in npm. iOS xcframework is fetched at app `pod install` ([ADR-0009](./docs/adr/0009-ios-vendored-xcframework-pod-install-fetch.md)); Android App Remote at Gradle build ([ADR-0008](./docs/adr/0008-ios-spotify-sdk-via-spm.md)). See [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md).

## Release lanes

Both lanes ship the full Auth + App Remote API ([ADR-0006](./docs/adr/0006-namespaced-api-and-app-remote-scope.md)). The major version selects the **Expo SDK runtime**, not a different feature set ([ADR-0005](./docs/adr/0005-sdk-lane-versioning.md)).

### `1.x` on `v1` (Expo SDK 55)

- npm **`1.x`**, branch **`v1`**, iOS 15.1+, `expo-modules-core@^3.x`
- **`1.0.0`** is published; install with `npm install @wwdrew/expo-spotify-sdk@1` (or `@sdk55`; releases from `v1` use that dist-tag so `latest` stays on `2.x`)
- Config plugin: string/tuple form in `app.json` / `app.config.ts` only

### `2.x` on `main` (Expo SDK 56+)

- npm **`2.x`**, branch **`main`**, iOS 16.4+, `expo-modules-core@^56`
- Active development; **`2.0.0`** pending Release Please merge
- **Typed config plugin** on `main` only: `import { withSpotifySdk } from "@wwdrew/expo-spotify-sdk/plugin"` in `app.config.ts`. Legacy string/tuple plugin syntax remains supported.

**Explicitly not in v1 (or any version):**

- Spotify Web API wrappers (catalog, library reads, recently played, top items, recommendations, playlist mutations) — consumers call REST themselves with the access token. Spotify is tightening Web API access (see [Feb 2026 migration](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)) and we don't want to be on the hook for that surface.
- Spotify Connect device transfer / device list — Web API only.
- Web platform — this library targets iOS and Android only. There is no web support and none is planned.
- Any in-app audio playback — Spotify's model is "remote-control the Spotify app". No exceptions.

## Related docs

- [README.md](./README.md) — install, quick start, troubleshooting, migration from v0.x.
- [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md) — native SDK fetch, npm packaging, version bumps.
- [docs/api-reference.md](./docs/api-reference.md) — method reference.
- [docs/error-codes.md](./docs/error-codes.md) — per-namespace error codes.
- [docs/adr/](./docs/adr/) — architecture decision records.
