import Foundation
import SpotifyiOS

/// Public, structured errors thrown by the coordinator. Each case carries the
/// JS-facing error code in `code`, mirroring the Android `CodedException`
/// taxonomy.
enum SpotifyError: Error {
  case invalidConfiguration(String)
  case authInProgress
  case userCancelled
  case spotifyNotInstalled
  case underlying(Error)

  var code: String {
    switch self {
    case .invalidConfiguration: return "INVALID_CONFIG"
    case .authInProgress:       return "AUTH_IN_PROGRESS"
    case .userCancelled:        return "USER_CANCELLED"
    case .spotifyNotInstalled:  return "SPOTIFY_NOT_INSTALLED"
    case .underlying:           return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .invalidConfiguration(let m): return m
    case .authInProgress:              return "Another authentication request is already in progress"
    case .userCancelled:               return "Authentication was cancelled by the user"
    case .spotifyNotInstalled:         return "The Spotify app is not installed on this device"
    case .underlying(let err):         return err.localizedDescription
    }
  }
}

/// `actor` ensures `pending` is mutated only on the actor's serial executor;
/// no manual locks needed.
actor SpotifyAuthCoordinator {
  static let shared: SpotifyAuthCoordinator? = SpotifyAuthCoordinator.create()

  private let sptConfiguration: SPTConfiguration
  private let sessionManager: SPTSessionManager
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
    sessionManager.application(UIApplication.shared, open: url, options: options)
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
    cont?.resume(with: result)
  }
}

/// `SPTSessionManagerDelegate` requires NSObject conformance, which an actor
/// can't satisfy directly. The bridge is a tiny NSObject that hops the call
/// onto the actor's executor.
final class SpotifySessionDelegateBridge: NSObject, SPTSessionManagerDelegate {
  weak var coordinator: SpotifyAuthCoordinator?

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
    let mapped: Error = mapSDKError(error)
    NSLog("[ExpoSpotifySDK] didFailWithError %@", String(describing: error))
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

  /// Translate a few well-known SDK error shapes into our taxonomy.
  private func mapSDKError(_ error: Error) -> Error {
    let nsError = error as NSError
    let description = nsError.localizedDescription.lowercased()
    if description.contains("cancel") {
      return SpotifyError.userCancelled
    }
    return SpotifyError.underlying(NSError(
      domain: nsError.domain,
      code: nsError.code,
      userInfo: [NSLocalizedDescriptionKey: describeError(nsError)]
    ))
  }

  /// Build a diagnostic string from an NSError that includes the domain,
  /// code, localized description, and the full chain of underlying errors.
  /// Used because `SPTError` (and many `URLSession` errors it wraps) often
  /// have an empty `localizedDescription`, surfacing as "undefined reason"
  /// in JS without this expansion.
  private func describeError(_ error: NSError) -> String {
    var parts: [String] = []
    parts.append("\(error.domain) code \(error.code)")
    let desc = error.localizedDescription
    if !desc.isEmpty {
      parts.append("\"\(desc)\"")
    }
    var ui = error.userInfo
    ui.removeValue(forKey: NSUnderlyingErrorKey)
    ui.removeValue(forKey: NSLocalizedDescriptionKey)
    if !ui.isEmpty {
      parts.append("userInfo=\(ui)")
    }
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
      parts.append("→ underlying: \(describeError(underlying))")
    }
    return parts.joined(separator: " ")
  }
}
