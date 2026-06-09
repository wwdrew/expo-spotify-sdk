# Attribution and scope

## Native SDKs

This project wraps (does not fork) Spotify's official mobile SDKs:

- [Spotify iOS SDK](https://github.com/spotify/ios-sdk) (v5.x) — Auth + App Remote
- [Spotify Android SDK](https://github.com/spotify/android-sdk) (v4.x) — Auth + App Remote

Use of those SDKs is subject to [Spotify's Developer Terms](https://developer.spotify.com/terms) and the licenses bundled with each SDK distribution.

The iOS xcframework is re-distributed in npm (fetched from Spotify's GitHub before publish, [ADR-0001](./docs/adr/0001-build-time-download-of-spotify-native-sdks.md)). Android App Remote is fetched at Gradle build ([ADR-0008](./docs/adr/0008-ios-spotify-sdk-via-spm.md)). See [docs/guides/native-sdk-distribution.md](./docs/guides/native-sdk-distribution.md).

## What this library does not include

- **Spotify Web API** (`https://api.spotify.com`) — not wrapped. Consumers call REST with the access token from `Auth.authenticate()`.
- **Spotify Web Playback SDK** — out of scope (browser playback).
- **Spotify Connect device transfer** — Web API only; not part of App Remote.
- **In-app audio decoding/playback** — playback always happens in the official Spotify app.

## Prior art

See [README.md — Acknowledgements](./README.md#acknowledgements).
