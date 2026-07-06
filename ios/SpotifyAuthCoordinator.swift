import ExpoModulesCore
import Foundation
import SpotifyiOS
import UIKit

/// `actor` ensures `pending` is mutated only on the actor's serial executor;
/// no manual locks needed.
actor SpotifyAuthCoordinator {
  static let shared: SpotifyAuthCoordinator? = SpotifyAuthCoordinator.create()

  private let sptConfiguration: SPTConfiguration
  nonisolated(unsafe) private let sessionManager: SPTSessionManager
  private let bridge: SpotifySessionDelegateBridge
  private var pending: CheckedContinuation<SPTSession, Error>?

  private init(sptConfiguration: SPTConfiguration, sessionManager: SPTSessionManager, bridge: SpotifySessionDelegateBridge) {
    self.sptConfiguration = sptConfiguration
    self.sessionManager = sessionManager
    self.bridge = bridge
    bridge.coordinator = self
  }

  private static func create() -> SpotifyAuthCoordinator? {
    guard
      let configuration = ExpoSpotifyConfiguration.fromInfoPlist(),
      let sptConfig = configuration.sptConfiguration
    else {
      NSLog("[ExpoSpotifySDK] Missing or invalid `ExpoSpotifySDK` Info.plist entry")
      return nil
    }
    let bridge = SpotifySessionDelegateBridge()
    let manager = SPTSessionManager(configuration: sptConfig, delegate: bridge)
    return SpotifyAuthCoordinator(sptConfiguration: sptConfig, sessionManager: manager, bridge: bridge)
  }

  /// Synchronous getter used by the module's `Function("isAvailable")`. Safe
  /// to call from any thread because the underlying SDK property is read-only
  /// state derived from the installed-apps query.
  nonisolated func isSpotifyAppInstalled() -> Bool {
    sessionManager.isSpotifyAppInstalled
  }

  /// Synchronous URL-handler dispatcher used by the AppDelegate / SceneDelegate
  /// subscribers to forward redirects to the SPTSessionManager.
  nonisolated func handleOpenURL(_ url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    SpotifyMainThread.run {
      sessionManager.application(UIApplication.shared, open: url, options: options)
    }
  }

  func authenticate(
    scopes: SPTScope,
    tokenSwapURL: URL?,
    tokenRefreshURL: URL?,
    showDialog: Bool = false
  ) async throws -> SPTSession {
    guard pending == nil else { throw SpotifyError.authInProgress }

    // SPTConfiguration is a reference type shared with the session manager, so
    // mutating it here takes effect for the upcoming initiateSession call.
    sptConfiguration.tokenSwapURL = tokenSwapURL
    sptConfiguration.tokenRefreshURL = tokenRefreshURL
    bridge.updateAuthContext(
      tokenSwapURL: tokenSwapURL,
      tokenRefreshURL: tokenRefreshURL
    )
    // alwaysShowAuthorizationDialog is a property on SPTSessionManager, not an
    // SPTAuthorizationOptions flag (the options enum has no such case).
    sessionManager.alwaysShowAuthorizationDialog = showDialog

    NSLog(
      "[ExpoSpotifySDK] initiateSession redirectURL=%@ tokenSwapURL=%@ tokenRefreshURL=%@ showDialog=%d",
      sptConfiguration.redirectURL.absoluteString,
      tokenSwapURL?.absoluteString ?? "nil",
      tokenRefreshURL?.absoluteString ?? "nil",
      showDialog ? 1 : 0
    )

    return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<SPTSession, Error>) in
      self.pending = cont
      Task { @MainActor in
        self.sessionManager.initiateSession(with: scopes, options: .default, campaign: nil)
      }
    }
  }

  func deliver(_ result: Result<SPTSession, Error>) {
    let cont = pending
    pending = nil
    bridge.clearAuthContext()
    cont?.resume(with: result)
  }

  /// Forcibly cancel any in-flight authenticate() call. The pending
  /// continuation (if any) is resumed with `userCancelled` and `pending` is
  /// cleared. Safe to call when nothing is in flight (no-op).
  ///
  /// Needed because the SPTSessionManager delegate callbacks are not
  /// guaranteed to fire — e.g. when Spotify never redirects back to the host
  /// app — leaving `pending` set forever and every subsequent authenticate()
  /// rejecting with `authInProgress`.
  func cancelPending() {
    guard let cont = pending else { return }
    pending = nil
    cont.resume(throwing: SpotifyError.userCancelled)
  }
}

/// `SPTSessionManagerDelegate` requires NSObject conformance, which an actor
/// can't satisfy directly. The bridge is a tiny NSObject that hops the call
/// onto the actor's executor.
final class SpotifySessionDelegateBridge: NSObject, SPTSessionManagerDelegate {
  private struct AuthContext {
    let tokenSwapURL: URL?
    let tokenRefreshURL: URL?
  }

  weak var coordinator: SpotifyAuthCoordinator?
  private var authContext: AuthContext?

  func updateAuthContext(tokenSwapURL: URL?, tokenRefreshURL: URL?) {
    authContext = AuthContext(tokenSwapURL: tokenSwapURL, tokenRefreshURL: tokenRefreshURL)
  }

  func clearAuthContext() {
    authContext = nil
  }

  func sessionManager(manager _: SPTSessionManager, didInitiate session: SPTSession) {
    NSLog(
      "[ExpoSpotifySDK] didInitiate accessToken.length=%d refreshToken.length=%d expirationDate=%@ scope=%lu",
      session.accessToken.count,
      session.refreshToken.count,
      session.expirationDate as NSDate,
      session.scope.rawValue
    )
    Task { await coordinator?.deliver(.success(session)) }
  }

  func sessionManager(manager _: SPTSessionManager, didFailWith error: Error) {
    NSLog("[ExpoSpotifySDK] didFailWithError %@", error.safeLogSummary)
    let mapped = SpotifyAuthErrorMapping.classify(
      error,
      context: .init(tokenSwapConfigured: authContext?.tokenSwapURL != nil)
    )
    Task { await coordinator?.deliver(.failure(mapped)) }
  }

  func sessionManager(manager _: SPTSessionManager, didRenew session: SPTSession) {
    NSLog(
      "[ExpoSpotifySDK] didRenew accessToken.length=%d refreshToken.length=%d",
      session.accessToken.count,
      session.refreshToken.count
    )
    Task { await coordinator?.deliver(.success(session)) }
  }
}
