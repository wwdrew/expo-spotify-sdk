import ExpoModulesCore
import Foundation
import SpotifyiOS

// MARK: — App Remote error types

enum AppRemoteError: Error {
  case connectionFailed(String)
  case connectionLost(String)
  case notConnected(String)
  case unknown(String)

  var code: String {
    switch self {
    case .connectionFailed: return "CONNECTION_FAILED"
    case .connectionLost:   return "CONNECTION_LOST"
    case .notConnected:     return "NOT_CONNECTED"
    case .unknown:          return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .connectionFailed(let m): return m
    case .connectionLost(let m):   return m
    case .notConnected(let m):     return m
    case .unknown(let m):          return m
    }
  }
}

/// Bridges an `AppRemoteError` through expo-modules-core's exception system so
/// JS callers receive a structured `code` and `reason`, not "undefined reason".
final class AppRemoteException: Exception, @unchecked Sendable {
  private let appRemoteCode: String
  private let appRemoteMessage: String

  init(_ error: AppRemoteError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.appRemoteCode = error.code
    self.appRemoteMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { appRemoteCode }
  override var reason: String { appRemoteMessage }
}

// MARK: — Coordinator

/// Manages the `SPTAppRemote` singleton and the IPC connection lifecycle to
/// the Spotify app. Mirrors the design of `SpotifyAuthCoordinator`.
///
/// - The `SPTAppRemote` instance is created fresh on each `connect()` call so
///   the access token (which may change across sessions) is always current.
/// - `connectionStateString` is `nonisolated(unsafe)` so the module can query
///   it synchronously from the Expo bridge without an async hop. Writes only
///   happen from within the actor's isolation, so the value is safe to read for
///   display purposes (occasional stale reads are acceptable).
actor SpotifyAppRemoteCoordinator {
  static let shared: SpotifyAppRemoteCoordinator? = SpotifyAppRemoteCoordinator.create()

  private let sptConfiguration: SPTConfiguration
  private let delegateBridge: SpotifyAppRemoteDelegateBridge
  private var appRemote: SPTAppRemote?
  private var connectContinuation: CheckedContinuation<Void, Error>?

  nonisolated(unsafe) private(set) var connectionStateString: String = "disconnected"

  /// Injected by the module on `OnCreate` so connection state changes and
  /// errors are propagated as JS events.
  var onConnectionStateChange: ((String) -> Void)?
  var onConnectionError: ((String, String) -> Void)?

  private init(sptConfiguration: SPTConfiguration, delegateBridge: SpotifyAppRemoteDelegateBridge) {
    self.sptConfiguration = sptConfiguration
    self.delegateBridge = delegateBridge
    delegateBridge.coordinator = self
  }

  private static func create() -> SpotifyAppRemoteCoordinator? {
    guard
      let configuration = ExpoSpotifyConfiguration.fromInfoPlist(),
      let sptConfig = configuration.sptConfiguration
    else {
      NSLog("[ExpoSpotifySDK] AppRemote: missing or invalid `ExpoSpotifySDK` Info.plist entry")
      return nil
    }
    return SpotifyAppRemoteCoordinator(
      sptConfiguration: sptConfig,
      delegateBridge: SpotifyAppRemoteDelegateBridge()
    )
  }

  // MARK: — Public interface

  func connect(accessToken: String) async throws {
    if appRemote?.isConnected == true { return }
    guard connectContinuation == nil else {
      throw AppRemoteError.connectionFailed("A connection attempt is already in progress")
    }

    transitionState("connecting")

    let params = SPTAppRemoteConnectionParams(
      accessToken: accessToken,
      defaultImageSize: CGSize.zero,
      imageFormat: .any
    )
    let remote = SPTAppRemote(
      configuration: sptConfiguration,
      connectionParameters: params,
      logLevel: .error
    )
    remote.delegate = delegateBridge
    appRemote = remote

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      self.connectContinuation = cont
      Task { @MainActor in remote.connect() }
    }
  }

  func disconnect() {
    // If a connect() is still in flight, cancel it cleanly.
    if let cont = connectContinuation {
      connectContinuation = nil
      cont.resume(throwing: AppRemoteError.connectionFailed("Disconnected before connection completed"))
    }
    appRemote?.disconnect()
    appRemote = nil
    transitionState("disconnected")
  }

  nonisolated func isConnected() -> Bool {
    connectionStateString == "connected"
  }

  func getConnectionState() -> String {
    connectionStateString
  }

  // MARK: — Delegate bridge callbacks

  func didConnect() {
    transitionState("connected")
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume()
  }

  func didFailToConnect(error: Error?) {
    appRemote = nil
    let msg = error.map { describeNSError($0 as NSError) } ?? "Unknown connection failure"
    let remoteError = AppRemoteError.connectionFailed(msg)
    transitionState("disconnected")
    onConnectionError?(remoteError.code, remoteError.message)
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume(throwing: remoteError)
  }

  func didDisconnect(error: Error?) {
    appRemote = nil
    transitionState("disconnected")
    if let error = error {
      let msg = describeNSError(error as NSError)
      onConnectionError?(AppRemoteError.connectionLost(msg).code, msg)
    }
  }

  // MARK: — Helpers

  private func transitionState(_ state: String) {
    connectionStateString = state
    onConnectionStateChange?(state)
  }

  private func describeNSError(_ error: NSError) -> String {
    var parts: [String] = ["\(error.domain) code \(error.code)"]
    let desc = error.localizedDescription
    if !desc.isEmpty { parts.append("\"\(desc)\"") }
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
      parts.append("→ \(describeNSError(underlying))")
    }
    return parts.joined(separator: " ")
  }
}

// MARK: — Delegate bridge

/// `SPTAppRemoteDelegate` requires `NSObject` conformance, which an `actor`
/// cannot satisfy directly. This bridge is a tiny `NSObject` that hops each
/// delegate callback onto the actor's executor via a `Task`.
final class SpotifyAppRemoteDelegateBridge: NSObject, SPTAppRemoteDelegate {
  weak var coordinator: SpotifyAppRemoteCoordinator?

  func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
    NSLog("[ExpoSpotifySDK] AppRemote: connection established")
    Task { await coordinator?.didConnect() }
  }

  func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: (any Error)?) {
    NSLog("[ExpoSpotifySDK] AppRemote: connection failed — %@", String(describing: error))
    Task { await coordinator?.didFailToConnect(error: error) }
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: (any Error)?) {
    NSLog("[ExpoSpotifySDK] AppRemote: disconnected — %@", String(describing: error))
    Task { await coordinator?.didDisconnect(error: error) }
  }
}
