# Attribution and scope

## Native SDKs

This project wraps (does not fork) Spotify's official mobile SDKs:

- [Spotify iOS SDK](https://github.com/spotify/ios-sdk) (v5.x) — Auth + App Remote
- [Spotify Android SDK](https://github.com/spotify/android-sdk) (v4.x) — Auth + App Remote

Use of those SDKs is subject to [Spotify's Developer Terms](https://developer.spotify.com/terms) and the licenses bundled with each SDK distribution.

The iOS xcframework and Android App Remote AAR are **re-distributed inside the `@wwdrew/expo-spotify-sdk` npm package** (~1.5 MB). They are fetched from Spotify's official GitHub sources at publish time, not committed to this repository. See [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md).

## What this library does not include

- **Spotify Web API** (`https://api.spotify.com`) — not wrapped. Consumers call REST with the access token from `Auth.authenticate()`.
- **Spotify Web Playback SDK** — out of scope (browser playback).
- **Spotify Connect device transfer** — Web API only; not part of App Remote.
- **In-app audio decoding/playback** — playback always happens in the official Spotify app.

## Prior art

See [README.md — Acknowledgements](./README.md#acknowledgements).
