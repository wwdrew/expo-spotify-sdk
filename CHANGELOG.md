# Changelog

## [2.3.1](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.3.0...expo-spotify-sdk-v2.3.1) (2026-07-07)


### Bug Fixes

* **ios:** avoid SIGABRT when NSError description key is non-string ([#72](https://github.com/wwdrew/expo-spotify-sdk/issues/72)) ([6e7654c](https://github.com/wwdrew/expo-spotify-sdk/commit/6e7654c440ce5d722c6e89488315a49d2dbefbb1))

## [2.3.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.2.3...expo-spotify-sdk-v2.3.0) (2026-06-29)


### Features

* **auth:** add REFRESH_TOKEN_EXPIRED code for expired/revoked refresh tokens ([bd73914](https://github.com/wwdrew/expo-spotify-sdk/commit/bd73914bf299e50e30267367ee6ea0b9ac4394c7))


### Bug Fixes

* **android:** match structured invalid_grant field on refresh 400 ([b4dfae0](https://github.com/wwdrew/expo-spotify-sdk/commit/b4dfae02b5a6eac453663a5cf9f9d0940d830b7a))
* **ios:** classify com.spotify.sdk.login code 1 as user cancellation ([8670b62](https://github.com/wwdrew/expo-spotify-sdk/commit/8670b62d9aed13e5b62bd18006f2c9ee7c31c104))
* **ios:** map cancellation NSErrors that bypass the session delegate ([0fac47b](https://github.com/wwdrew/expo-spotify-sdk/commit/0fac47ba3b4ed0a0737f8f885b9ed281af391c05))
* **ios:** redact NSError userInfo values from logs and JS errors ([3568076](https://github.com/wwdrew/expo-spotify-sdk/commit/35680767bbde279d7720958aace572c128e908f4))


### Documentation

* document Spotify refresh-token six-month expiry and invalid_grant handling ([c6133cf](https://github.com/wwdrew/expo-spotify-sdk/commit/c6133cf0fec16650a58aca1cb5485ebbc406b45a))


### Code Refactoring

* **ios:** unify auth error classification into one canonical mapper ([16ca8a1](https://github.com/wwdrew/expo-spotify-sdk/commit/16ca8a183243cad7d7e760f5194a1a5403d8bd3a))

## [2.2.3](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.2.2...expo-spotify-sdk-v2.2.3) (2026-06-23)


### Bug Fixes

* improve auth error mapping ([#67](https://github.com/wwdrew/expo-spotify-sdk/issues/67)) ([9322972](https://github.com/wwdrew/expo-spotify-sdk/commit/9322972cd999b7de78853d7efd27754beb801096))

## [2.2.2](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.2.1...expo-spotify-sdk-v2.2.2) (2026-06-09)


### Bug Fixes

* **ios:** fetch SpotifyiOS via CocoaPods binary pod at pod install ([#64](https://github.com/wwdrew/expo-spotify-sdk/issues/64)) ([d2ec75e](https://github.com/wwdrew/expo-spotify-sdk/commit/d2ec75e0d446757438eefb5db1e195a4b6e84ba1))

## [2.2.1](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.2.0...expo-spotify-sdk-v2.2.1) (2026-06-08)


### Bug Fixes

* **android:** drop explicit Ant download timeouts for Spotify AAR fetch ([#61](https://github.com/wwdrew/expo-spotify-sdk/issues/61)) ([cfa5d72](https://github.com/wwdrew/expo-spotify-sdk/commit/cfa5d725a8284968fbf1ffe7b2445746e6071a79))


### Code Refactoring

* **ios:** extract App Remote connection lifecycle ([#59](https://github.com/wwdrew/expo-spotify-sdk/issues/59)) ([a51ef04](https://github.com/wwdrew/expo-spotify-sdk/commit/a51ef04aeb96bf33d85e7b01a6d6f7d2d9eaef90))

## [2.2.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.1.0...expo-spotify-sdk-v2.2.0) (2026-06-06)


### Features

* **app-remote:** add AppRemote.authorizeAndPlay to wake a suspended Spotify ([#54](https://github.com/wwdrew/expo-spotify-sdk/issues/54)) ([bb4e23f](https://github.com/wwdrew/expo-spotify-sdk/commit/bb4e23f4ac390203357a5285c73121c4cd6b9126))


### Bug Fixes

* **release:** bundle Spotify native SDKs in npm ([#55](https://github.com/wwdrew/expo-spotify-sdk/issues/55)) ([3efec15](https://github.com/wwdrew/expo-spotify-sdk/commit/3efec1521524063b1eb78367c1f721c8ce0168c4))


### Code Refactoring

* **native:** resolve Spotify SDKs at build time instead of bundling in npm ([#58](https://github.com/wwdrew/expo-spotify-sdk/issues/58)) ([c284f99](https://github.com/wwdrew/expo-spotify-sdk/commit/c284f99c83412dae90e6582ae0ee0156bf963502))

## [2.1.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.0.0...expo-spotify-sdk-v2.1.0) (2026-06-03)


### Features

* GH-46 improve tokenSwap endpoint contract clarity ([#49](https://github.com/wwdrew/expo-spotify-sdk/issues/49)) ([88c3760](https://github.com/wwdrew/expo-spotify-sdk/commit/88c37600f0fe00f1308274a31d24de0bc64d3dc1))


### Documentation

* SDK lane model + maintainability refactors (recreated) ([#51](https://github.com/wwdrew/expo-spotify-sdk/issues/51)) ([903b9e0](https://github.com/wwdrew/expo-spotify-sdk/commit/903b9e00ef0afd88385240d256c4e2d0b713a2af))

## [2.0.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v1.0.0...expo-spotify-sdk-v2.0.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* Expo SDK 56 lane + typed config plugin (v2.0.0)

### Features

* Expo SDK 56 lane + typed config plugin (v2.0.0) ([4c025a3](https://github.com/wwdrew/expo-spotify-sdk/commit/4c025a39c1b7dc8445accfe108ac1cde3e9e2b79))


### Bug Fixes

* **ci:** bypass expo-module CLI after install EACCES ([#43](https://github.com/wwdrew/expo-spotify-sdk/issues/43)) ([e9a3e0a](https://github.com/wwdrew/expo-spotify-sdk/commit/e9a3e0a44e17c662e0716a06ffbfe490b223aba5))


### Documentation

* document main as SDK 56 (2.x) and v1 as SDK 55 (1.x) ([#44](https://github.com/wwdrew/expo-spotify-sdk/issues/44)) ([a4ae220](https://github.com/wwdrew/expo-spotify-sdk/commit/a4ae220a47402d5c2df144f0129f5782a8193ccd))

## [2.0.0](https://github.com/wwdrew/expo-spotify-sdk/compare/v1.0.0...v2.0.0) (unreleased)

**Expo SDK 56 lane** — install `2.x` when your app targets Expo SDK 56+ (iOS 16.4+). For SDK 55, use `1.x` on the `v1` branch. See [ADR-0005](docs/adr/0005-sdk-lane-versioning.md).

### Features

* **Typed config plugin** — import `withSpotifySdk` from `@wwdrew/expo-spotify-sdk/plugin` in `app.config.ts` (Expo SDK 56+). String/tuple plugin syntax remains supported.

### Build

* Bump iOS deployment target to 16.4 and dev dependencies to Expo SDK 56 (`expo-modules-core@^56`, `expo-module-scripts@^56`).
* Example app pinned to Expo SDK 56.

## [1.0.0](https://github.com/wwdrew/expo-spotify-sdk/compare/v0.8.0...v1.0.0) (2026-05-28)

**Expo SDK 55 lane** — install `1.x` when your app targets Expo SDK 55 (iOS 15.1+). See [ADR-0005](docs/adr/0005-sdk-lane-versioning.md).

### Features

* **App Remote** — `AppRemote`, `Player`, `User`, `Content`, and `Images` namespaces with iOS and Android native bridges
* **React hooks** — `useSession`, `useConnectionState`, `usePlayerState`, `useCurrentTrack`, `useIsPlaying`, `usePlaybackPosition`, `useCapabilities`, `useLibraryState`
* **Namespaced Auth** — `Auth.authenticate`, `Auth.refresh`, `Auth.cancelPending`, `Auth.addListener("sessionChange")` (v0 top-level exports retained as deprecated shims)
* **Error hierarchy** — per-namespace `*Error` subclasses (`AuthError`, `AppRemoteError`, `PlayerError`, …) with typed `*ErrorCode` unions
* **`SpotifyURI`** — branded URI type and helpers

### Documentation

* README rewritten for v1 API, Premium requirements, error code reference, SDK lane mapping, and auto-connect pattern
* [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md), [docs/RELEASE.md](docs/RELEASE.md), [ATTRIBUTION.md](ATTRIBUTION.md)

## [0.8.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v0.7.1...expo-spotify-sdk-v0.8.0) (2026-05-07)


### Features

* add cancelPendingAuthAsync to recover from leaked auth continuations ([#24](https://github.com/wwdrew/expo-spotify-sdk/issues/24)) ([a649523](https://github.com/wwdrew/expo-spotify-sdk/commit/a649523cc8d63bf7b451a394215e17577485c091))


### Bug Fixes

* classify Android EMPTY auth response as USER_CANCELLED ([#26](https://github.com/wwdrew/expo-spotify-sdk/issues/26)) ([d3f73be](https://github.com/wwdrew/expo-spotify-sdk/commit/d3f73beaa9600c560aef83ce3d245e419e10491e))
* correct SDK_VERSION drift and auto-sync on future releases ([#22](https://github.com/wwdrew/expo-spotify-sdk/issues/22)) ([1eb6123](https://github.com/wwdrew/expo-spotify-sdk/commit/1eb6123e2a3ea88556bb7cd249d0489fed4c12bc))
* **ios:** escape "+" in form-encoded refresh token bodies ([#27](https://github.com/wwdrew/expo-spotify-sdk/issues/27)) ([eff0ecb](https://github.com/wwdrew/expo-spotify-sdk/commit/eff0ecb4c73cbffefe450802e4b0d25e4e843a39))
* **ios:** log unknown scope strings instead of silently dropping them ([#28](https://github.com/wwdrew/expo-spotify-sdk/issues/28)) ([5b77ce7](https://github.com/wwdrew/expo-spotify-sdk/commit/5b77ce78b9640326f4a7bc09b9b76e6e7fedc748))
* plumb previous scopes through refreshSessionAsync ([#25](https://github.com/wwdrew/expo-spotify-sdk/issues/25)) ([4fa1374](https://github.com/wwdrew/expo-spotify-sdk/commit/4fa1374571e7d6a7d56093b909bf3ed222c9d08c))


### Documentation

* add AGENTS.md and agent skills configuration ([#29](https://github.com/wwdrew/expo-spotify-sdk/issues/29)) ([5cb6910](https://github.com/wwdrew/expo-spotify-sdk/commit/5cb6910a3dda20ca2ba42be652fbe4aa9f2c5f3b))

## [0.7.1](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v0.7.0...expo-spotify-sdk-v0.7.1) (2026-04-30)


### Bug Fixes

* **plugin:** change default redirectPathPattern from "/.*" to ".*" ([#20](https://github.com/wwdrew/expo-spotify-sdk/issues/20)) ([af77084](https://github.com/wwdrew/expo-spotify-sdk/commit/af7708491796b0b7bdc8b6b7afb908200564ae6e))

## [0.7.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v0.6.0...expo-spotify-sdk-v0.7.0) (2026-04-29)


### Features

* add showDialog option to authenticateAsync ([#18](https://github.com/wwdrew/expo-spotify-sdk/issues/18)) ([5014798](https://github.com/wwdrew/expo-spotify-sdk/commit/5014798d7d2f1e154de7acb548beec45f3819f7e))

## [0.6.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v0.5.0...expo-spotify-sdk-v0.6.0) (2026-04-29)


### Features

* add android authentication ([#5](https://github.com/wwdrew/expo-spotify-sdk/issues/5)) ([ee8e789](https://github.com/wwdrew/expo-spotify-sdk/commit/ee8e7892dc6e1af8e64d7893a72c7236ff770c64))
* add config plugins ([f587fe5](https://github.com/wwdrew/expo-spotify-sdk/commit/f587fe5fdb059d1e162a67cc350d69c3de692a79))
* add initial dummy authenticate function ([f097703](https://github.com/wwdrew/expo-spotify-sdk/commit/f09770342af4c229c24cdf9614fa2444c29d2105))
* add isAvailable function to check whether Spotify app is available on the device ([78b1866](https://github.com/wwdrew/expo-spotify-sdk/commit/78b18668049db5353779a0d08d0cf29a6c06f7f5))
* add Spotify config to object in Info.plist ([488a26a](https://github.com/wwdrew/expo-spotify-sdk/commit/488a26a205215d1b5bff2a56813cbc39c1596ef9))
* add support for more config values ([9a8dcb5](https://github.com/wwdrew/expo-spotify-sdk/commit/9a8dcb5d34a9aaa5e3adf662467229368deeaf27))
* allow passing token swap and refresh values in config ([#1](https://github.com/wwdrew/expo-spotify-sdk/issues/1)) ([ee55cad](https://github.com/wwdrew/expo-spotify-sdk/commit/ee55cadcae55a11296c98711a3d946311d85f8a3))
* create initial plugin file ([098eb3c](https://github.com/wwdrew/expo-spotify-sdk/commit/098eb3c03eb30262db042026fa92d9ef6207e158))
* implement flag to toggle whether to send code or session on authentication ([#2](https://github.com/wwdrew/expo-spotify-sdk/issues/2)) ([90c59d6](https://github.com/wwdrew/expo-spotify-sdk/commit/90c59d69eddf526cde3eab4a7dd19895c3a37c7d))
* implement initial version ([9895589](https://github.com/wwdrew/expo-spotify-sdk/commit/9895589a4a02f6d393f1726fa31bf9797a347ccf))
* SDK upgrades, Expo Router example, CI & release automation ([#14](https://github.com/wwdrew/expo-spotify-sdk/issues/14)) ([c0318fd](https://github.com/wwdrew/expo-spotify-sdk/commit/c0318fd426e9303316e4b4f8c5479b6034892a33))
* update android plugin to add required native fields to build.gradle and include dependencies ([b775ddd](https://github.com/wwdrew/expo-spotify-sdk/commit/b775dddedf54adf62f93dcc23391fe4a99cc1116))
* upgrade ios sdk ([#6](https://github.com/wwdrew/expo-spotify-sdk/issues/6)) ([1ed1cbd](https://github.com/wwdrew/expo-spotify-sdk/commit/1ed1cbdb1b8ff3509d281933e972075e98063ddf))


### Bug Fixes

* add missing config types ([83e6b06](https://github.com/wwdrew/expo-spotify-sdk/commit/83e6b062a10b0942e50c8b12f8f9cd533f5c4bfe))
* **android:** fix compilation errors when using sdk 52 ([#10](https://github.com/wwdrew/expo-spotify-sdk/issues/10)) ([58c041b](https://github.com/wwdrew/expo-spotify-sdk/commit/58c041bb3294d418937beea8e86baf1889e5ea7d))
* don't accept handling url unless it has been ([c900e2a](https://github.com/wwdrew/expo-spotify-sdk/commit/c900e2abc000c6c2105080a7e8dbc7632c66bb77))
* include android folder in package ([1ca884b](https://github.com/wwdrew/expo-spotify-sdk/commit/1ca884bb42cec21cd6a72e7b6c48885070fce5aa))
* remove feature to return code only ([#3](https://github.com/wwdrew/expo-spotify-sdk/issues/3)) ([3a84e75](https://github.com/wwdrew/expo-spotify-sdk/commit/3a84e75d19a676c686e39c55a2a8b8de59df24dd))
* use maven auth module and remove redundant dependency ([209e5b9](https://github.com/wwdrew/expo-spotify-sdk/commit/209e5b93911948502ccf85c3442ca7a6fc97855b))


### Documentation

* add initial README ([f6a6492](https://github.com/wwdrew/expo-spotify-sdk/commit/f6a64920dd19c435b2f19b03d30ea045a0cedfc4))
* android authentication is now included ([e4c8596](https://github.com/wwdrew/expo-spotify-sdk/commit/e4c859690e63643301487c979a7d7b2dfa771749))
* update docs for latest release ([12d4e57](https://github.com/wwdrew/expo-spotify-sdk/commit/12d4e57787cef2dee47aa21ee6ea930405bc1546))


### Code Refactoring

* improve types ([bb4b393](https://github.com/wwdrew/expo-spotify-sdk/commit/bb4b393233321431a2324dda69d0fb2e76cb1d29))
* tidy up plugin functions ([5eafd36](https://github.com/wwdrew/expo-spotify-sdk/commit/5eafd364fc80d80f213215416ebd268a1c7dc5dc))
