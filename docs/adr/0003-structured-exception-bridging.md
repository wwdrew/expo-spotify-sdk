# ADR-0003: Structured Exception Bridging to JS

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** @wwdrew

## Context

`authenticateAsync` and `refreshSessionAsync` reject with a `SpotifyError`
carrying a `SpotifyErrorCode` and a human-readable `message`. This is the
public contract (`src/ExpoSpotifySDK.types.ts`, README "SpotifyError"
section); consumers branch on `e.code` and surface `e.message` to error
reporting.

The contract is honoured on Android. It was being silently broken on iOS.

### What was happening on iOS (pre-0.9)

`ios/ExpoSpotifySDKModule.swift` caught `SpotifyError` / `SpotifyRefreshError`
and re-threw across the JS bridge like this:

```swift
throw GenericException("\(error.code): \(error.message)")
```

`GenericException<String>` stores its argument in `param: String` but does
**not** override `Exception.reason`, which defaults to the literal string
`"undefined reason"`. The `expo-modules-core` `AsyncFunction` machinery then
wraps the thrown exception in `FunctionCallException`, whose JS-facing
description is:

```text
Calling the '<fn>' function has failed
→ Caused by: <cause.reason>
```

…and whose `code` is `cause.code`. Because the cause was a bare
`GenericException` with no overrides, JS received:

- `err.code = "ERR_GENERIC"` (derived from the class name)
- `err.message = "Calling the 'authenticateAsync' function has failed\n→ Caused by: undefined reason"`

The structured `SpotifyError.code` ("`USER_CANCELLED`", "`UNKNOWN`", etc.)
and the underlying SDK message (the iOS coordinator's `describeError` output
with the full `NSError` chain) were **dropped on the floor** between Swift
and JS. The `rethrowAsSpotifyError` helper in `src/index.ts` worked around
this with a regex that scanned `err.message` for a leading `"CODE: msg"`
prefix — which the buggy wrap never produced — and always fell through to
`SpotifyError("UNKNOWN", "Calling the '…' function has failed")`.

Net effect: every iOS failure that wasn't a clean
`USER_CANCELLED`/`AUTH_IN_PROGRESS` path arrived in consumer code as
`{ code: "UNKNOWN", message: "Calling the 'authenticateAsync' function has failed" }`,
with the actual cause only visible via `NSLog` in Xcode console.

### What Android does

`android/.../ExpoSpotifySDKModule.kt` throws `CodedException(code, message, cause)`
directly. `expo-modules-core` Kotlin wraps it in `DecoratedException` (the
analog of iOS's `FunctionCallException`), which **does** override `code` to
return `cause.code` and renders `message` as
`"Call to function '<module>.<fn>' has been rejected.\n→ Caused by: <cause.message>"`.

So the structured code reaches JS correctly on Android; the visible wrapper
prefix differs from iOS but the canonical `→ Caused by:` separator (with a
trailing space) is the same.

## Decision

We will bridge each platform's structured error type through a thin
`Exception` / `CodedException` subclass that explicitly overrides `code`
and `reason`/`message`, and we will normalise the cross-platform wrapper
prefix on the JS side.

### iOS

Add two `Exception` subclasses, one per error enum, that project the enum's
`code` and `message` through `expo-modules-core`:

```swift
final class SpotifyAuthException: Exception, @unchecked Sendable {
  private let spotifyCode: String
  private let spotifyMessage: String

  init(_ error: SpotifyError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.spotifyCode = error.code
    self.spotifyMessage = error.message
    super.init(file: file, line: line, function: function)
    self.cause = error.underlyingCause
  }

  override var code: String { spotifyCode }
  override var reason: String { spotifyMessage }
}
```

`SpotifyRefreshException` mirrors this for `SpotifyRefreshError`.

The module catches and re-throws with the new types:

```swift
} catch let error as SpotifyError {
  …
  throw SpotifyAuthException(error)
}
```

### Preserve the underlying NSError as `cause`

`SpotifyError.underlying` previously stored the original `NSError`
flattened into a synthetic NSError whose only populated field was
`NSLocalizedDescriptionKey`. The original `NSUnderlyingErrorKey` chain was
discarded. The new shape carries the rendered string **and** the original
error:

```swift
case underlying(message: String, cause: Error)
```

`mapSDKError` passes the original NSError through unchanged as `cause`, and
the rendered string into `message`. `SpotifyAuthException.init` reads
`SpotifyError.underlyingCause` and sets `Exception.cause` accordingly, so
the chain survives into JS-side `err.cause` (visible to Sentry breadcrumbs,
React Native red-box, debug logs).

### Android

No change. `CodedException(code, message, cause)` already does the right
thing.

### JS — normalise the wrapper prefix

`expo-modules-core` adds a platform-specific wrapper prefix to the message
of any error thrown from an `AsyncFunction` body:

- iOS: `"Calling the '<fn>' function has failed\n→ Caused by: <reason>"`
- Android: `"Call to function '<module>.<fn>' has been rejected.\n→ Caused by: <reason>"`

The canonical `→ Caused by:` separator (with a trailing space) is identical
on both platforms. `rethrowAsSpotifyError` in `src/index.ts` now:

1. Prefers `err.code` (set structurally by `expo-modules-core`'s reject
   call from `Exception.code`/`CodedException.code`).
2. Strips the wrapper prefix by splitting on the last `→ Caused by:`
   occurrence (separator includes a trailing space) and using the suffix
   as the JS-facing `message`.
3. Falls back to the pre-0.9 `"CODE: msg"` regex parse only for consumers
   still running against older native binaries (degrades gracefully rather
   than breaking).

The result is identical JS surface on both platforms:

```ts
catch (e) {
  if (e instanceof SpotifyError) {
    e.code        // → "USER_CANCELLED", "NETWORK_ERROR", "UNKNOWN", …
    e.message     // → "Authentication was cancelled by the user"
                  //   (iOS: original SpotifyError.message, including the
                  //    full NSError chain for `.underlying`;
                  //    Android: localizedMessage from the CodedException)
  }
}
```

## Alternatives Considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Status quo (`GenericException("\(code): \(message)")`) + JS regex parse | **Rejected** | The regex never matched because `GenericException.reason` was `"undefined reason"`, not `"CODE: msg"`. The intended contract was simply not delivered. |
| `Exception(name: …, description: …, code: …)` initialiser | **Rejected** | The 4-arg initialiser sets `description` and `code` but not `reason`, and `description` is `lazy var` that is later overwritten by `concatDescription(reason, withCause: cause)` in some Expo versions. Subclassing is the only stable contract. |
| Drop the iOS coordinator's `SpotifyError` enum, throw `Exception` subclasses directly | **Rejected** | The enum is useful internally (e.g. `cancelPending()` resumes the continuation with `SpotifyError.userCancelled`; the `actor`'s state transitions reason about it). Keeping it and bridging via a thin wrapper preserves separation between "coordinator error model" and "JS-bridge error model." |
| Encode the structured error in the `userInfo`/event payload and have JS reconstruct it | **Rejected** | We already do this for the `onSessionChange` event (`didFail` payload carries `{ code, message }`). Duplicating it as the rejection path adds two failure surfaces (event-listener vs awaited promise) that can disagree on shape. Native rejection should be the source of truth; the event is a convenience mirror. |
| Match the wrapper prefix exactly between iOS and Android | **Rejected** | The wrapper prefix is owned by `expo-modules-core`, not us. Stripping it in JS is the right seam — and the canonical `→ Caused by:` separator is already cross-platform. |

## Consequences

### Positive

- The public `SpotifyError` contract is now actually delivered on iOS, not
  just promised by the README.
- Consumers can branch on `e.code` cleanly (no `e.code === "UNKNOWN"`
  fallback for cases that were never genuinely unknown).
- Underlying `NSError` chains survive into JS via `err.cause`, giving
  Sentry and debuggers the full diagnostic picture (`NSURLErrorDomain
  -1200` TLS errors, `SPTErrorDomain` codes, etc.).
- Same JS surface on both platforms; the only platform-detectable
  difference is the exact phrasing of the wrapper prefix in the *raw*
  native `err.message`, which we strip before consumers see it.
- The JS-side regex fallback keeps consumers on older native binaries
  working during the upgrade window.

### Negative

- Two extra `Exception` subclasses to maintain on iOS (one per error enum).
  Acceptable — they're each ~10 lines and the pattern is mechanical.
- `SpotifyError.underlying` is now a two-arg associated value
  (`message:cause:`). Internal-only enum, so no public-API break, but any
  in-repo `switch` exhaustiveness errors needed updating.

### Neutral

- The `onSessionChange` `didFail` event still emits
  `{ code, message }` with the pre-wrap message — unchanged. Consumers
  using the event listener path were never affected by the bug; they get
  the same shape as before.

## Implementation

| File | Change |
| --- | --- |
| `ios/SpotifyAuthCoordinator.swift` | `SpotifyError.underlying` becomes `(message: String, cause: Error)`; add `underlyingCause` projection; add `SpotifyAuthException: Exception` subclass; `mapSDKError` now stores the original `NSError` as cause. |
| `ios/SpotifyTokenRefreshClient.swift` | Add `underlyingCause` to `SpotifyRefreshError`; add `SpotifyRefreshException: Exception` subclass. |
| `ios/ExpoSpotifySDKModule.swift` | Replace `throw GenericException(...)` with `throw SpotifyAuthException(error)` / `throw SpotifyRefreshException(error)`. |
| `android/.../*.kt` | No change. |
| `src/index.ts` | Replace the legacy `"CODE: msg"` regex parse with: prefer `err.code` set by `expo-modules-core`, strip the wrapper prefix via the `→ Caused by:` separator, retain the regex as a legacy fallback. |
| `README.md` | Document that on iOS, `SpotifyError.UNKNOWN.message` now contains the rendered underlying NSError chain (domain, code, descriptions), making the historically-opaque "Spotify auth failed" log line genuinely diagnosable. |

## Validation

Verified by:

1. `yarn typecheck` / `yarn lint` / `yarn build` / `yarn test` all pass
   after the change.
2. End-to-end on a real iOS device with a deliberately broken TLS path
   (e.g. Proxyman intercepting `tokenSwapURL` without a trusted root CA):
   `authenticateAsync` now rejects with
   `{ code: "UNKNOWN", message: "NSURLErrorDomain code -1200 \"<desc>\" → underlying: …" }`
   instead of
   `{ code: "UNKNOWN", message: "Calling the 'authenticateAsync' function has failed" }`.
3. `USER_CANCELLED` on iOS still produces the same JS shape it did before
   (the iOS coordinator already pattern-matched `description.contains("cancel")`
   into `SpotifyError.userCancelled`; the new bridging just stops eating
   the code).
4. Android JS shape unchanged across the upgrade (the regex fallback was
   never engaged on Android because `err.code` was always set; new code
   path takes the same branch).
