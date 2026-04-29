# Security policy

## Supported versions

Only the latest release receives security fixes. We follow semver, so patches
are back-ported within a major version where feasible.

| Version | Supported |
|---|---|
| 0.x (latest) | ✅ |
| < latest | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities as public GitHub issues.**

Send an email to the maintainer at the address listed in `package.json` with:

1. A description of the vulnerability and its potential impact.
2. Steps to reproduce or a proof-of-concept.
3. Suggested fix (if you have one).

You will receive an acknowledgement within 48 hours. We aim to issue a fix
within 14 days for critical issues and 90 days for others, coordinating
disclosure timing with you.

## Scope

This library is a native wrapper around the official Spotify iOS and Android
SDKs. It does not store credentials or tokens — that responsibility belongs to
your app. Please be aware of the following:

- **Never embed `CLIENT_SECRET` in your app bundle.** Always use a token swap
  server (see the README). The library will emit a `console.warn` if it
  detects you are using the Android TOKEN (implicit) flow, which does not
  require a server but returns a less-secure session.

- **The token swap endpoint must be secured.** Use HTTPS and add appropriate
  rate-limiting. A stolen authorization code can be exchanged for an access
  token even after your app has finished using it.

- **`refreshToken` storage.** Refresh tokens should be stored in the device's
  secure keystore (iOS Keychain, Android Keystore) rather than
  `AsyncStorage`. This is the app's responsibility, not the library's.
