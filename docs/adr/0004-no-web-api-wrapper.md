# ADR-0004: No Web API wrapper

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** @wwdrew

## Context

The Spotify developer surface has three operational layers:

1. **Auth SDK** — `SPTSessionManager` (iOS), `com.spotify.android:auth` (Android). OAuth via the installed Spotify app or web fallback. Returns an access token.
2. **App Remote SDK** — `SpotifyAppRemote` (iOS), `com.spotify.android:app-remote` (Android). IPC channel to the running Spotify app; controls playback, browses user library state, fetches cover art, walks Spotify's recommended-content tree.
3. **Web API** — `https://api.spotify.com/v1/*`. REST: catalog search, get-by-id, user's full saved library, recently played, top items, audio features, recommendations, playlist mutations, Spotify Connect device transfer.

Layers 1 and 2 are native SDKs shipped as xcframework / AAR. Layer 3 is REST you call with an OAuth access token.

The library today wraps only layer 1. Looking at comparable cross-platform music libraries (e.g. `@wwdrew/expo-apple-music`), the pattern is to wrap all three layers behind a domain-modelled API (`Catalog`, `Library`, `History`, `Player`, ...). Doing that for Spotify would mean an additional native REST client per platform, a coverage matrix of ~30–50 endpoints, JSON mappers, pagination helpers, error normalisation per endpoint, and ongoing tracking of Spotify's Web API surface.

### Three things pushed against doing that for Spotify

1. **Spotify is actively tightening Web API access.** The [February 2026 migration](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) restricts Development Mode apps to 5 test users and requires the app owner to hold a Premium subscription. The trajectory is toward more restrictions, not fewer. Wrapping endpoints that may become unavailable or rate-limited differently per consumer is a moving target.

2. **The Apple Music analogue requires the Web API wrapper.** Apple Music's MusicKit (the native SDK) covers playback, auth, and a *subset* of catalog/library reads. The Web API (`api.music.apple.com`) is the only way to do mutations, charts, recommendations endpoints, etc. — so wrapping it is unavoidable if you want a complete client. **Spotify is different**: every "data" feature relevant to a remote-control library lives in App Remote (transport, player state, library state for current track, cover art, recommended-content browsing). The set of features that *only* lives in Web API (search, full catalog, full saved library, recently played, playlist mutations) is genuinely beyond the "control playback in the Spotify app" framing.

3. **The consumer already holds the access token.** `Auth.authenticate()` returns a `SpotifySession` with an OAuth `accessToken`. Calling `fetch("https://api.spotify.com/v1/me", { headers: { Authorization: \`Bearer ${token}\` } })` is one line of JS. The cost of *not* wrapping is small; the cost of *wrapping* (native REST client, mappers, types, error normalisation, two-platform parity, deprecation tracking) is large.

## Decision

**This library wraps only Spotify's native SDKs — the Auth SDK and the App Remote SDK.** It will never wrap the Spotify Web API.

Consumers who need catalog search, full saved library reads, recently played history, top items, audio features, playlist mutations, or Spotify Connect device transfer use the access token from `Auth.authenticate()` to call `https://api.spotify.com/v1/*` themselves with any HTTP client.

## Consequences

### Positive

- Smaller scope, faster to ship, fewer moving parts.
- Insulated from Spotify Web API restriction tightening — the library's surface doesn't depend on endpoints Spotify may restrict further.
- Single source of truth for "data": App Remote when it's about controlling the Spotify app, consumer's own Web API calls when it's about anything else. No "is this the App Remote `Content` API or the Web API `/me/top` endpoint?" confusion.
- Avoids the maintenance burden of a native REST client + JSON mappers + per-endpoint coverage tracking + per-endpoint error normalisation.

### Negative

- Consumers needing Web API features write more code than they would with a wrapper. README needs a "calling the Web API yourself" recipe (basically a `fetch` example with the access token).
- Consumers comparing this library to comparable wrappers may perceive it as incomplete.
- If Spotify ever migrates an App Remote capability into Web-API-only territory, that capability disappears from this library and consumers have to write their own Web API call.

### Neutral

- The `Auth.authenticate()` access token is the boundary between "what this library does" and "what consumers do themselves". That boundary is explicit and documented.

## Implementation

Documentation only — no code change. The README, `CONTEXT.md`, and `docs/V1_PLAN.md` all state explicitly that this library does not wrap the Spotify Web API and never will. Consumer-facing recipes in the README for the common Web API patterns (calling `/v1/me`, search, recently played) using the access token with `fetch`.

## Validation

Not applicable — policy decision.
