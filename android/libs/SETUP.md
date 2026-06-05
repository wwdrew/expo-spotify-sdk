# Android App Remote SDK

The Spotify App Remote SDK for Android is **not** on Maven Central. This module
vendors `spotify-app-remote-release-0.8.0.aar` here and ships it inside the npm
package.

## Local development

The `.aar` is gitignored. Fetch it once:

```sh
bash scripts/fetch-spotify-sdks.sh
```

Release CI runs the same script in `prepublishOnly` before `npm publish`.

## Bumping the App Remote version

Update the pinned constants in `scripts/fetch-spotify-sdks.sh` and
`android/build.gradle`, then ship a new release of this package.
