# ADR-0002: Auto-Cancel Stale Pending Auth on iOS

- **Status:** Proposed
- **Date:** 2026-05-07
- **Deciders:** @wwdrew

## Context

`SpotifyAuthCoordinator` on iOS holds a single `CheckedContinuation` (`pending`) for the in-flight `authenticateAsync` call. The contract is "one auth at a time": a second call while `pending != nil` rejects with `AUTH_IN_PROGRESS`. The `pending` slot is cleared when `SPTSessionManagerDelegate` fires `didInitiate(_:)` or `didFailWith:`.

ADR-0001 isn't relevant to this decision; the area in scope is `ios/SpotifyAuthCoordinator.swift` and the JS-layer wrapper.

### Today's behaviour (post v0.7.x)

After the leaked-continuation fix shipped in v0.7.x:

- `cancelPendingAuthAsync()` is exposed on the JS API. It resumes the continuation with `userCancelled` and clears `pending`.
- The recommended consumer pattern (documented in `README.md`) is to call `cancelPendingAuthAsync()` defensively before every `authenticateAsync()`, on the assumption that the previous attempt may have leaked.
- Android is unaffected: `SpotifyAuthCoordinator.kt` uses a `Mutex` held across `launcher.launch(input)`, and structured concurrency releases the lock when the activity-result coroutine returns. There is no equivalent "leaked state" failure mode on Android.

### Why iOS leaks

`SPTSessionManager` is not guaranteed to fire its delegate. Concrete cases observed in production:

- Network/DNS failure between the app and Spotify (`tokenSwapURL` unreachable). Spotify's web view bounces, the auth never returns to us, no delegate fires.
- User opens the Spotify app, backgrounds, force-quits Spotify without completing.
- iOS scene-graph edge cases where the redirect URL is delivered to a scene we don't observe.

In each case, `pending` stays set forever and every subsequent `authenticateAsync()` rejects with `AUTH_IN_PROGRESS` until the app process is killed.

### The constraint nobody outside the SDK can see

When we "cancel" a pending continuation, **we do not actually stop `SPTSessionManager`.** There is no public API for that. All we do is:

1. Resume our continuation with `userCancelled`.
2. Clear our reference to the continuation.

If the underlying Spotify auth flow was actually still progressing — e.g. the user is mid-login in the Spotify app — and it completes after we've already cancelled, the delegate fires `didInitiate(_:)` with a real session. `pending == nil` at that point, so `deliver(.success(...))` silently does nothing. **We drop a valid session on the floor.**

### Why "always auto-cancel on next authenticate()" is wrong

Naive auto-cancel — "if `pending != nil`, cancel it and proceed" — turns every accidental double-call (button double-tap, `useEffect` retry loop) into a session-discarding event:

1. User taps Connect Spotify. Coordinator sets `pending`. Spotify app opens. User starts logging in.
2. A re-render fires the second `authenticateAsync()` call. Coordinator cancels `pending` (resumes with `userCancelled`), sets a new `pending`, and redundantly calls `initiateSession` again.
3. User finishes login in Spotify. Spotify SDK fires `didInitiate(_:)`. The bridge's `Task { await coordinator?.deliver(.success(session)) }` runs. `pending` still refers to the second call's continuation, but the session was triggered by the first call. We resolve the wrong continuation. (At best, this works by accident; at worst, the second `initiateSession` has different scopes/options and the delivered session doesn't match what the second caller asked for.)

In short: with no real ability to interrupt `SPTSessionManager`, **time-of-receipt vs time-of-initiation become decoupled**, and any naive cancel-on-reentry policy mismatches sessions to callers.

### What signals can we trust

Two signals indicate that a pending continuation is **almost certainly** abandoned by the underlying SDK and safe to cancel:

1. **Age.** Spotify auth completes (success or failure) in seconds in the success path, and fails fast on most error paths (network, no Spotify app installed, user cancellation in Spotify). A `pending` older than ~60s is overwhelmingly likely to be a leak, not a user still logging in.
2. **App foreground transition without an inbound URL.** If the user backgrounded our app to the Spotify auth flow and returned to our app without us receiving a redirect URL, the auth flow is dead from our side regardless of what `SPTSessionManager` thinks. (This is the same signal browsers use to time out OAuth popup flows.)

Either signal alone is conservative; together they cover both leak shapes seen in production.

## Decision

We will **auto-cancel stale pending auth** on `authenticateAsync()` re-entry, using a staleness predicate combining age and foreground-without-redirect.

### Coordinator changes

`SpotifyAuthCoordinator` gains:

- `pendingStartedAt: Date?` — set alongside `pending`, cleared alongside it.
- `pendingFlowSawForeground: Bool` — set to `true` if the app foregrounds while `pending != nil`. Reset to `false` whenever a new `pending` is set, and we observe `UIApplication.didBecomeActiveNotification`.
- `handleOpenURL(_:options:)` clears `pendingFlowSawForeground` (a redirect arrived → not a leak yet).

`authenticate(...)` decision tree:

```text
if pending == nil → proceed (set pendingStartedAt = now)
else:
  if isStalePending() → cancelPending() with reason `.timedOut`; proceed
  else → throw .authInProgress
```

`isStalePending()` returns `true` if either:

- `pendingStartedAt` is older than `pendingStaleThreshold` (default: 60 seconds), or
- `pendingFlowSawForeground == true`.

### New error case: `pendingTimedOut`

`SpotifyError` gains a case `pendingTimedOut` with code `AUTH_TIMED_OUT`, distinct from `userCancelled`. Used both:

- when `cancelPending()` is invoked by the staleness path (so the prior caller's promise rejects with a meaningful reason rather than a generic cancellation), and
- as a new public error code on the JS taxonomy (`SpotifyErrorCode = ... | "AUTH_TIMED_OUT"`).

This matters because `userCancelled` already has UX meaning ("the user explicitly cancelled"), and we should not lie to consumers' analytics by reporting timeouts as cancellations.

### `cancelPendingAuthAsync()` is no longer required, but is retained

The JS API stays. Removing it would break consumers who already call it on their critical path, and there are legitimate uses (deterministic teardown in tests; explicit "user navigated away, kill any pending flow"). Documentation will:

- Stop recommending it as a defensive preflight before every `authenticateAsync()`.
- Explain the new auto-cancel behaviour and that the preflight is now redundant.
- Keep `cancelPendingAuthAsync` documented as the explicit escape hatch.

### Configurability

`pendingStaleThreshold` is a coordinator-level constant, not an `authenticateAsync()` parameter. Reasoning: this is a leak-recovery threshold, not a per-call timeout. Per-call timeouts are a different feature (see Open Questions) and would compose with this, not replace it.

### Android

No change. The `Mutex`-based coordinator already releases on coroutine cancellation / activity-result return, so there is no analogous leak.

## Alternatives Considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Status quo (manual `cancelPendingAuthAsync` preflight from JS) | **Rejected** | Footgun. Every consumer must learn this pattern; forgetting it strands the user in `AUTH_IN_PROGRESS` purgatory. |
| Always auto-cancel on re-entry (no staleness check) | **Rejected** | Drops legitimate sessions when callers race. See "Why naive auto-cancel is wrong" above. |
| Time-only staleness (no foreground signal) | **Rejected for primary, retained as fallback** | Catches the "user came back five minutes later" case but waits 60s to recover even when the app foregrounded with no redirect — which is *immediate* evidence of a leak. |
| Foreground-only staleness (no time threshold) | **Rejected** | Sufficient for the in-process leak cases observed today, but the time threshold is cheap defence-in-depth and useful in headless contexts (tests, scene configurations where the active-notification doesn't fire as expected). |
| Per-call timeout (`authenticateAsync({ timeoutMs })`) | **Deferred** | Composes with this design rather than replacing it. Worth doing later if consumers want bounded UX (e.g. show their own error after 30s) but does not solve leak recovery on its own. |
| Reach into `SPTSessionManager` to actually cancel its in-flight flow | **Rejected** | No public API. Reflection / private-API access disqualifies the SDK from App Store review. |
| Replace `SPTSessionManager` with a custom auth flow (PKCE in `ASWebAuthenticationSession`) | **Rejected for this ADR** | Materially larger scope. Worth its own ADR if we ever want to drop SPT for auth, but unrelated to leak recovery. |

## Consequences

### Positive

- The most common leak mode ("Spotify never redirected back, user retried") is recovered transparently. Consumers no longer need to know about `cancelPendingAuthAsync`.
- The Songkick-mobile-style preflight pattern can be removed from consumer code without regression.
- Genuine double-tap races within 60s (and before app foreground) still get `AUTH_IN_PROGRESS`, which is the correct signal for "you have a UI bug, debounce your button." Auto-cancel doesn't paper over those.
- New `AUTH_TIMED_OUT` error code lets consumers distinguish leak-recovery from user-initiated cancellation in analytics and error reporting.

### Negative

- Adds lifecycle-observer wiring to the coordinator (`UIApplication.didBecomeActiveNotification`). Modest complexity; tested in isolation.
- The staleness threshold is a magic number. 60 seconds is defensible but arbitrary — too long for impatient users, too short for slow networks. Mitigation: leave it adjustable in code if real consumer feedback suggests tuning.
- Adds a new public error code, which is technically a non-breaking additive change but expands the taxonomy consumers must handle. Mitigation: README documents it; default catch-all paths still work because the code is a string.
- Theoretical lost-session race shrinks but doesn't disappear: if SPTSessionManager genuinely completes auth in the few-millisecond window after `cancelPending()` runs but before the new `initiateSession()` is dispatched, we still drop the session. The probability is low (the user would have to complete login in Spotify in <1ms across a process boundary), but it exists. Acceptable given the alternative is the existing leak.

### Neutral

- Android coordinator unchanged — no Android-side complexity added.
- `cancelPendingAuthAsync` JS API retained — no breaking change for current consumers.
- The diagnostic logging added in v0.7.x (`NSLog` of error codes in the bridge) is unaffected and remains useful.

## Implementation Sketch

| File | Change |
| --- | --- |
| `ios/SpotifyAuthCoordinator.swift` | Add `pendingStartedAt`, `pendingFlowSawForeground`, `pendingStaleThreshold` (default 60s). New `isStalePending()` predicate. `authenticate(...)` consults it before throwing `authInProgress`. Add `case pendingTimedOut` to `SpotifyError`. Hook `UIApplication.didBecomeActiveNotification` (via a small `NSObject` observer; the actor itself can't be the observer). Reset `pendingFlowSawForeground = false` when `handleOpenURL` is called. |
| `src/ExpoSpotifySDK.types.ts` | Add `"AUTH_TIMED_OUT"` to `SpotifyErrorCode`. |
| `src/index.ts` | No surface change; the new code rides through the existing `SpotifyError` mapping. |
| `README.md` | Update "Recovery from stuck auth state" section: remove the "always call `cancelPendingAuthAsync()` first" recommendation; document the new auto-recovery and the `AUTH_TIMED_OUT` code. Keep `cancelPendingAuthAsync` as documented escape hatch. |
| `CHANGELOG.md` | Document the new behaviour and the new error code. Note that consumers who relied on the preflight pattern can remove it (non-breaking; the call becomes a no-op). |

## Open Questions

- **Should `pendingStaleThreshold` be configurable from JS?** Probably not in this ADR — overrideable defaults invite per-app drift. If a consumer asks, expose it as a module-level setter; until then, hard-coded.
- **Should we add `authenticateAsync({ timeoutMs })` for explicit per-call timeouts?** Out of scope here. Worth considering as a follow-up if consumers want a way to surface "still waiting" UX before the 60s staleness window.
- **Should `SpotifyError.pendingTimedOut` carry the prior caller's start timestamp?** Useful for diagnostics if we surface it in the JS error. Defer until a consumer asks; trivially additive.
- **Is the foreground signal flaky on iPad split-view / scene-aware apps?** `didBecomeActiveNotification` fires per scene activation. We can be conservative and treat any active-notification as "user came back," accepting that in scene-rich apps we may auto-cancel slightly more eagerly than necessary. Worth instrumenting in v1 of the implementation rather than designing around it speculatively.

## Validation

Before merging the implementation PR, verify on a real iOS device:

1. **Happy path unchanged.** `authenticateAsync()` succeeds normally; no spurious `AUTH_TIMED_OUT`.
2. **Genuine double-tap rejection.** Two `authenticateAsync()` calls fired within 100ms still yield `AUTH_IN_PROGRESS` for the second.
3. **Time-based recovery.** Trigger a leaked continuation (e.g. start auth, kill network mid-flow, wait 90s, retry). Second call succeeds; first promise rejects with `AUTH_TIMED_OUT`.
4. **Foreground-based recovery.** Start auth, switch to Spotify, force-quit Spotify, return to our app. Retry within <60s should succeed (foreground signal kicks in before time threshold).
5. **No dropped sessions in the common race.** Tap Connect Spotify, immediately tap again (within ~200ms). Complete auth in Spotify. The session is delivered to one of the two callers (whichever's continuation is current); neither reports `AUTH_TIMED_OUT`.
6. **`cancelPendingAuthAsync` still works.** Explicit calls still resume `pending` with `userCancelled` (NOT `AUTH_TIMED_OUT`), preserving the user-initiated semantic.
