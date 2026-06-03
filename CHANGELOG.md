# Changelog

## [1.0.0](https://github.com/wwdrew/expo-spotify-sdk/compare/expo-spotify-sdk-v2.0.0...expo-spotify-sdk-v1.0.0) (2026-06-03)


### ⚠ BREAKING CHANGES

* Expo SDK 56 lane + typed config plugin (v2.0.0)

### Features

* add android authentication ([#5](https://github.com/wwdrew/expo-spotify-sdk/issues/5)) ([63f09bb](https://github.com/wwdrew/expo-spotify-sdk/commit/63f09bbae647162e0c12eadbe3c25c8f3b4c902d))
* add cancelPendingAuthAsync to recover from leaked auth continuations ([#24](https://github.com/wwdrew/expo-spotify-sdk/issues/24)) ([3541075](https://github.com/wwdrew/expo-spotify-sdk/commit/35410754ea2fa9523a3bfd7203e1b7c5e7930458))
* add config plugins ([dd1fd72](https://github.com/wwdrew/expo-spotify-sdk/commit/dd1fd72e6ad389c78672ba2d0b5b7425f173c596))
* add initial dummy authenticate function ([b64abb1](https://github.com/wwdrew/expo-spotify-sdk/commit/b64abb1134d2b52293f0555d271f4c012fdbe804))
* add isAvailable function to check whether Spotify app is available on the device ([05083df](https://github.com/wwdrew/expo-spotify-sdk/commit/05083df1d0d0f3ef537d82c1c4e8c880e08e1fe0))
* add showDialog option to authenticateAsync ([#18](https://github.com/wwdrew/expo-spotify-sdk/issues/18)) ([d061642](https://github.com/wwdrew/expo-spotify-sdk/commit/d061642eb2252251407a14ed57d5065537db1c57))
* add Spotify config to object in Info.plist ([364f0f6](https://github.com/wwdrew/expo-spotify-sdk/commit/364f0f61ef87c2919e4a266174b7f74a400ca26f))
* add support for more config values ([fbd8110](https://github.com/wwdrew/expo-spotify-sdk/commit/fbd811065c53df79bd47fb4a517f52cddaeac89b))
* allow passing token swap and refresh values in config ([#1](https://github.com/wwdrew/expo-spotify-sdk/issues/1)) ([d6b3208](https://github.com/wwdrew/expo-spotify-sdk/commit/d6b32081f870e6888694f2b5f93b091a42199fb9))
* **api:** Phase 1 — namespace skeleton, error hierarchy, SpotifyURI ([#34](https://github.com/wwdrew/expo-spotify-sdk/issues/34)) ([dcc6f40](https://github.com/wwdrew/expo-spotify-sdk/commit/dcc6f40ee4954afb33c75f685a4cb42c22a15205))
* **app-remote:** Phase 2 — connection lifecycle (connect/disconnect/state) ([#35](https://github.com/wwdrew/expo-spotify-sdk/issues/35)) ([11a9218](https://github.com/wwdrew/expo-spotify-sdk/commit/11a9218744304a2e807fc22946023ba9254bd342))
* **content-images:** add Phase 5 content browsing and image loading ([#38](https://github.com/wwdrew/expo-spotify-sdk/issues/38)) ([3e78d77](https://github.com/wwdrew/expo-spotify-sdk/commit/3e78d7746c1fb1bc131e904600f1e95f05982c69))
* create initial plugin file ([6b8d511](https://github.com/wwdrew/expo-spotify-sdk/commit/6b8d51146a67aad5a833025ca75279d88d700498))
* Expo SDK 56 lane + typed config plugin (v2.0.0) ([7369fd2](https://github.com/wwdrew/expo-spotify-sdk/commit/7369fd279debd9a3a00b974d5bb6a5f039cebed5))
* **hooks:** restore missing Phase 4 hook exports ([#37](https://github.com/wwdrew/expo-spotify-sdk/issues/37)) ([41515d1](https://github.com/wwdrew/expo-spotify-sdk/commit/41515d1f57b763cfc5a6770d222ec9842d750982))
* implement flag to toggle whether to send code or session on authentication ([#2](https://github.com/wwdrew/expo-spotify-sdk/issues/2)) ([0f0186b](https://github.com/wwdrew/expo-spotify-sdk/commit/0f0186bf6f6d4f1ee2b0cbdbf71e641a8660cd09))
* implement initial version ([c2b9905](https://github.com/wwdrew/expo-spotify-sdk/commit/c2b9905e2aa1c15c2091e77488ff75c8d7300898))
* polish app remote demo ([#39](https://github.com/wwdrew/expo-spotify-sdk/issues/39)) ([c921d35](https://github.com/wwdrew/expo-spotify-sdk/commit/c921d3572bcbc555b8480a1993705e82520863c8))
* SDK upgrades, Expo Router example, CI & release automation ([#14](https://github.com/wwdrew/expo-spotify-sdk/issues/14)) ([3de7445](https://github.com/wwdrew/expo-spotify-sdk/commit/3de74453b1da3a7ed627cb47aa5590e07ae71dcc))
* update android plugin to add required native fields to build.gradle and include dependencies ([673734d](https://github.com/wwdrew/expo-spotify-sdk/commit/673734dd03d0cb2f3f164cd0bc454d44fd6683c5))
* upgrade ios sdk ([#6](https://github.com/wwdrew/expo-spotify-sdk/issues/6)) ([028e864](https://github.com/wwdrew/expo-spotify-sdk/commit/028e864270461f4695171213c9231dec6b79ce08))


### Bug Fixes

* add missing config types ([a7013a5](https://github.com/wwdrew/expo-spotify-sdk/commit/a7013a5242620daebfca8c355ad67aab2c3ec8a7))
* **android:** fix compilation errors when using sdk 52 ([#10](https://github.com/wwdrew/expo-spotify-sdk/issues/10)) ([134bbc8](https://github.com/wwdrew/expo-spotify-sdk/commit/134bbc80739e0354403f4475e6f7b479ccc18727))
* **ci:** bypass expo-module CLI after install EACCES ([#43](https://github.com/wwdrew/expo-spotify-sdk/issues/43)) ([3419df7](https://github.com/wwdrew/expo-spotify-sdk/commit/3419df79871b5df32cf6bec23af20d68f833148a))
* classify Android EMPTY auth response as USER_CANCELLED ([#26](https://github.com/wwdrew/expo-spotify-sdk/issues/26)) ([d7e5aea](https://github.com/wwdrew/expo-spotify-sdk/commit/d7e5aea60bbf7e8598061fe0c3c1272a13357239))
* correct SDK_VERSION drift and auto-sync on future releases ([#22](https://github.com/wwdrew/expo-spotify-sdk/issues/22)) ([b00fc47](https://github.com/wwdrew/expo-spotify-sdk/commit/b00fc478118e64cef82b8ab12ebfb8ad6d45ee60))
* don't accept handling url unless it has been ([d505297](https://github.com/wwdrew/expo-spotify-sdk/commit/d5052971484b75bae37285ad2811f3b69cd69b4c))
* include android folder in package ([04fdce9](https://github.com/wwdrew/expo-spotify-sdk/commit/04fdce968ef534a69315e93889003e7259c872ba))
* ios spotify sdk swift imports ([#40](https://github.com/wwdrew/expo-spotify-sdk/issues/40)) ([71e1245](https://github.com/wwdrew/expo-spotify-sdk/commit/71e124583885406f23ff679d174000369f668637))
* **ios:** bridge structured SpotifyError code and reason through to JS ([#31](https://github.com/wwdrew/expo-spotify-sdk/issues/31)) ([8d2fb5b](https://github.com/wwdrew/expo-spotify-sdk/commit/8d2fb5b5f9e6e7771da52034253e92877f39e07a))
* **ios:** escape "+" in form-encoded refresh token bodies ([#27](https://github.com/wwdrew/expo-spotify-sdk/issues/27)) ([baacce7](https://github.com/wwdrew/expo-spotify-sdk/commit/baacce75c6c049a2774f588c45742ad218b9f907))
* **ios:** log unknown scope strings instead of silently dropping them ([#28](https://github.com/wwdrew/expo-spotify-sdk/issues/28)) ([104bf50](https://github.com/wwdrew/expo-spotify-sdk/commit/104bf50fd9ae6c30c3ecfee1983fd07f4c381aa8))
* **plugin:** change default redirectPathPattern from "/.*" to ".*" ([#20](https://github.com/wwdrew/expo-spotify-sdk/issues/20)) ([93edca0](https://github.com/wwdrew/expo-spotify-sdk/commit/93edca030e0895e15688a6edfcbaf64bf076293e))
* plumb previous scopes through refreshSessionAsync ([#25](https://github.com/wwdrew/expo-spotify-sdk/issues/25)) ([c5f40b3](https://github.com/wwdrew/expo-spotify-sdk/commit/c5f40b3bc79393e4a583e3e308a3167c50ec4d1c))
* remove feature to return code only ([#3](https://github.com/wwdrew/expo-spotify-sdk/issues/3)) ([93dc470](https://github.com/wwdrew/expo-spotify-sdk/commit/93dc4700060101ce42ac46b5084a9a7e8180b8bb))
* use maven auth module and remove redundant dependency ([f9fcd58](https://github.com/wwdrew/expo-spotify-sdk/commit/f9fcd584e1507c3ac469437add3e7a887d6cc5b2))


### Documentation

* add AGENTS.md and agent skills configuration ([#29](https://github.com/wwdrew/expo-spotify-sdk/issues/29)) ([5582135](https://github.com/wwdrew/expo-spotify-sdk/commit/5582135eefec9db0579dd0d1b0cf03d7066bdbc0))
* add CONTEXT.md, V1_PLAN.md and ADRs 0004–0006 ([#33](https://github.com/wwdrew/expo-spotify-sdk/issues/33)) ([4c4405c](https://github.com/wwdrew/expo-spotify-sdk/commit/4c4405c817e1655c0f47b72baea1a0eed34495a0))
* add initial ADRs ([#30](https://github.com/wwdrew/expo-spotify-sdk/issues/30)) ([c5359be](https://github.com/wwdrew/expo-spotify-sdk/commit/c5359be5e426a8c1f9e3af9f3039bed914c018e4))
* add initial README ([341c5cc](https://github.com/wwdrew/expo-spotify-sdk/commit/341c5ccfddde1de912440d0568114fa3fd38ba38))
* android authentication is now included ([cdaa6ab](https://github.com/wwdrew/expo-spotify-sdk/commit/cdaa6abb901e0eb00f25e81ec39c6002cb87f2de))
* document main as SDK 56 (2.x) and v1 as SDK 55 (1.x) ([#44](https://github.com/wwdrew/expo-spotify-sdk/issues/44)) ([dd30027](https://github.com/wwdrew/expo-spotify-sdk/commit/dd3002764c0a36684595474b58becbd8e7196b14))
* update docs for latest release ([4c573a4](https://github.com/wwdrew/expo-spotify-sdk/commit/4c573a4a54e0aa1e2b686250c5fb1ab89e3c5705))


### Code Refactoring

* improve types ([12b2126](https://github.com/wwdrew/expo-spotify-sdk/commit/12b2126596985b247687d1044874018b814cfbd7))
* tidy up plugin functions ([d3c1c86](https://github.com/wwdrew/expo-spotify-sdk/commit/d3c1c863f9d21a72b4cc60861c0d8a28592ac197))


### Chores

* align release-please manifest and lockfile to 1.0.0 ([e503ac3](https://github.com/wwdrew/expo-spotify-sdk/commit/e503ac386823c7a25c6ff06f52b9befeda908b2b))

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
