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

  private let sessionManager: SPTSessionManager
  private let bridge: SpotifySessionDelegateBridge
  private var pending: CheckedContinuation<SPTSession, Error>?

  private init(sessionManager: SPTSessionManager, bridge: SpotifySessionDelegateBridge) {
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
    return SpotifyAuthCoordinator(sessionManager: manager, bridge: bridge)
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
    tokenRefreshURL: URL?
  ) async throws -> SPTSession {
    guard pending == nil else { throw SpotifyError.authInProgress }

    sessionManager.configuration.tokenSwapURL = tokenSwapURL
    sessionManager.configuration.tokenRefreshURL = tokenRefreshURL

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
    Task { await coordinator?.deliver(.success(session)) }
  }

  func sessionManager(manager _: SPTSessionManager, didFailWith error: Error) {
    let mapped: Error = mapSDKError(error)
    Task { await coordinator?.deliver(.failure(mapped)) }
  }

  func sessionManager(manager _: SPTSessionManager, didRenew session: SPTSession) {
    Task { await coordinator?.deliver(.success(session)) }
  }

  /// Translate a few well-known SDK error shapes into our taxonomy.
  private func mapSDKError(_ error: Error) -> Error {
    let nsError = error as NSError
    let description = nsError.localizedDescription.lowercased()
    if description.contains("cancel") {
      return SpotifyError.userCancelled
    }
    return SpotifyError.underlying(error)
  }
}
