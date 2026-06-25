import ExpoModulesCore
import AuthenticationServices
import Foundation
import SpotifyiOS
import UIKit

/// Public, structured errors thrown by the coordinator. Each case carries the
/// JS-facing error code in `code`, mirroring the Android `CodedException`
/// taxonomy.
enum SpotifyError: Error {
  case invalidConfiguration(String)
  case authInProgress
  case userCancelled
  case spotifyNotInstalled
  case networkError(message: String, cause: Error)
  case tokenSwapFailed(status: Int?, message: String, cause: Error)
  case tokenSwapParseError(message: String, cause: Error)
  case authError(message: String, cause: Error)
  case underlying(message: String, cause: Error)

  var code: String {
    switch self {
    case .invalidConfiguration: return "INVALID_CONFIG"
    case .authInProgress:       return "AUTH_IN_PROGRESS"
    case .userCancelled:        return "USER_CANCELLED"
    case .spotifyNotInstalled:  return "SPOTIFY_NOT_INSTALLED"
    case .networkError:         return "NETWORK_ERROR"
    case .tokenSwapFailed:      return "TOKEN_SWAP_FAILED"
    case .tokenSwapParseError:  return "TOKEN_SWAP_PARSE_ERROR"
    case .authError:            return "AUTH_ERROR"
    case .underlying:           return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .invalidConfiguration(let m):     return m
    case .authInProgress:                  return "Another authentication request is already in progress"
    case .userCancelled:                   return "Authentication was cancelled by the user"
    case .spotifyNotInstalled:             return "The Spotify app is not installed on this device"
    case .networkError(let message, _):    return message
    case .tokenSwapFailed(_, let message, _): return message
    case .tokenSwapParseError(let message, _): return message
    case .authError(let message, _):       return message
    case .underlying(let message, _):      return message
    }
  }

  /// The original error that caused this failure, if any. Surfaced as the
  /// JS-facing exception's `cause` so debugging / Sentry breadcrumbs keep the
  /// full chain rather than collapsing into "undefined reason".
  var underlyingCause: Error? {
    switch self {
    case .networkError(_, let cause): return cause
    case .tokenSwapFailed(_, _, let cause): return cause
    case .tokenSwapParseError(_, let cause): return cause
    case .authError(_, let cause): return cause
    case .underlying(_, let cause): return cause
    default:                        return nil
    }
  }
}

/// `Exception` subclass that projects a `SpotifyError`'s `code` and `message`
/// through `expo-modules-core`'s exception bridge so JS receives the structured
/// code and a meaningful reason — not the default "undefined reason" placeholder.
///
/// Without this wrapper an `AsyncFunction` rejection collapses to
/// `FunctionCallException` → `cause.reason = "undefined reason"` because the
/// previously-used `GenericException<String>` does not override `reason`.
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
    if isUserCancelled(error: nsError) {
      NSLog(
        "[ExpoSpotifySDK] mapSDKError classified=USER_CANCELLED domain=%@ code=%d detail=%@",
        nsError.domain,
        nsError.code,
        describeError(nsError)
      )
      return SpotifyError.userCancelled
    }

    if let classified = classifyNonCancellationAuthError(nsError) {
      return classified
    }

    // Keep the original NSError as `cause` so the structured underlying-chain
    // is preserved (Sentry, debug breadcrumbs); the rendered string goes to
    // `message` so JS callers get a single human-readable line.
    let detail = describeError(nsError)
    NSLog(
      "[ExpoSpotifySDK] mapSDKError classified=UNKNOWN domain=%@ code=%d detail=%@",
      nsError.domain,
      nsError.code,
      detail
    )
    return SpotifyError.underlying(message: detail, cause: nsError)
  }

  private func classifyNonCancellationAuthError(_ error: NSError) -> SpotifyError? {
    let detail = describeError(error)
    let lower = detail.lowercased()
    let tokenSwapConfigured = authContext?.tokenSwapURL != nil

    if isNetworkFailure(error) {
      return SpotifyError.networkError(message: "Network error during Spotify authentication: \(detail)", cause: error)
    }

    // OAuth-style rejection from Spotify auth endpoints — evaluated before the
    // tokenSwapConfigured gate so these are never misclassified as token-swap errors.
    if lower.contains("access_denied") || lower.contains("invalid_scope") || lower.contains("invalid_client") ||
      lower.contains("authorization") || lower.contains("oauth") || lower.contains("spotify account")
    {
      return SpotifyError.authError(
        message: "Spotify authorization failed: \(detail)",
        cause: error
      )
    }

    if let status = extractHTTPStatusCode(from: detail), status == 401 || status == 403 {
      return SpotifyError.authError(
        message: "Spotify authorization failed (HTTP \(status)): \(detail)",
        cause: error
      )
    }

    if tokenSwapConfigured || lower.contains("token swap") || lower.contains("token endpoint") || lower.contains("token exchange") {
      if let status = extractHTTPStatusCode(from: detail) {
        return SpotifyError.tokenSwapFailed(
          status: status,
          message: "Token swap server returned HTTP \(status): \(detail)",
          cause: error
        )
      }
      if lower.contains("parse") || lower.contains("json") || lower.contains("decode") || lower.contains("malformed") {
        return SpotifyError.tokenSwapParseError(
          message: "Token swap response was invalid: \(detail)",
          cause: error
        )
      }
      return SpotifyError.tokenSwapFailed(
        status: nil,
        message: "Token swap failed: \(detail)",
        cause: error
      )
    }

    return nil
  }

  /// Detect user cancellation from the full NSError chain rather than relying
  /// on a single wrapper domain/code pair.
  private func isUserCancelled(error: NSError) -> Bool {
    var visited = Set<ObjectIdentifier>()
    var stack: [NSError] = [error]

    while let current = stack.popLast() {
      let id = ObjectIdentifier(current)
      guard visited.insert(id).inserted else { continue }

      if isKnownCancellationCode(current) || messageLooksCancelled(current) {
        return true
      }

      if let underlying = current.userInfo[NSUnderlyingErrorKey] as? NSError {
        stack.append(underlying)
      }
    }

    return false
  }

  private func isKnownCancellationCode(_ error: NSError) -> Bool {
    if error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled {
      return true
    }

    if #available(iOS 12.0, *),
       error.domain == ASWebAuthenticationSessionErrorDomain,
       error.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
    {
      return true
    }

    if error.domain == "SFAuthenticationErrorDomain" && error.code == 1 {
      return true
    }

    // The Spotify iOS auth/login SDK reports user cancellation under its own
    // login domain with code 1. This domain contains "spotify" but not "auth",
    // so it is not caught by the fuzzy message matching either and must be
    // recognised explicitly.
    if error.domain == "com.spotify.sdk.login" && error.code == 1 {
      return true
    }

    return false
  }

  private func isNetworkFailure(_ error: NSError) -> Bool {
    var visited = Set<ObjectIdentifier>()
    var stack: [NSError] = [error]

    while let current = stack.popLast() {
      let id = ObjectIdentifier(current)
      guard visited.insert(id).inserted else { continue }

      if current.domain == NSURLErrorDomain,
         current.code != NSURLErrorCancelled
      {
        return true
      }

      if let underlying = current.userInfo[NSUnderlyingErrorKey] as? NSError {
        stack.append(underlying)
      }
    }

    return false
  }

  private func messageLooksCancelled(_ error: NSError) -> Bool {
    // Only apply fuzzy text matching in auth/browser domains to avoid mapping
    // unrelated transport or backend failures into USER_CANCELLED.
    guard isLikelyAuthCancellationDomain(error.domain) else {
      return false
    }

    let cancelKeywords = ["cancel", "canceled", "cancelled"]
    let negativeKeywords = [
      "timed out",
      "timeout",
      "network",
      "offline",
      "unreachable",
      "server",
      "unauthorized",
      "forbidden",
      "invalid"
    ]
    let messageParts = [
      error.localizedDescription,
      error.localizedFailureReason ?? "",
      error.userInfo[NSLocalizedDescriptionKey] as? String ?? "",
      error.userInfo[NSLocalizedFailureReasonErrorKey] as? String ?? ""
    ]
    let combined = messageParts
      .joined(separator: " ")
      .lowercased()

    if negativeKeywords.contains(where: { combined.contains($0) }) {
      return false
    }

    return cancelKeywords.contains(where: { combined.contains($0) })
  }

  private func isLikelyAuthCancellationDomain(_ domain: String) -> Bool {
    if domain == ASWebAuthenticationSessionErrorDomain || domain == "SFAuthenticationErrorDomain" {
      return true
    }

    // SPT wrappers commonly bubble auth-web errors under their own namespace.
    if domain.lowercased().contains("spotify") && domain.lowercased().contains("auth") {
      return true
    }

    return false
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

  private func extractHTTPStatusCode(from message: String) -> Int? {
    let patterns = [
      #"http\s+([1-5][0-9]{2})"#,
      #"status(?:\s+code)?[:=\s]+([1-5][0-9]{2})"#
    ]

    for pattern in patterns {
      guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
        continue
      }
      let range = NSRange(message.startIndex..<message.endIndex, in: message)
      guard let match = regex.firstMatch(in: message, options: [], range: range),
            match.numberOfRanges > 1,
            let codeRange = Range(match.range(at: 1), in: message)
      else {
        continue
      }
      if let code = Int(message[codeRange]) {
        return code
      }
    }

    return nil
  }
}
