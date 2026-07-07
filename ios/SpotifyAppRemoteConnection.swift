import Foundation
import SpotifyiOS
import UIKit

// MARK: — Connection models

enum AppRemoteConnectionKickoff: Equatable {
  case directConnect
  case authorizeAndPlay(uri: String)
}

struct AppRemoteConnectionAttempt {
  let remote: SPTAppRemote
  let kickoff: AppRemoteConnectionKickoff
}

// MARK: — Connection lifecycle

extension SpotifyAppRemoteCoordinator {
  func connect(accessToken: String) async throws {
    if appRemote?.isConnected == true { return }
    try await beginConnection(accessToken: accessToken, kickoff: .directConnect)
  }

  /// Wakes the Spotify app (via `authorizeAndPlayURI`), starts playback, and
  /// then completes the App Remote connection once Spotify redirects back.
  ///
  /// Unlike `connect()`, this works even when the Spotify app has been
  /// suspended: `authorizeAndPlayURI` performs an app-switch to Spotify, which
  /// revives it. Spotify then redirects back to the host app with an access
  /// token; `handleAuthorizeRedirect(_:)` consumes that redirect and calls
  /// `connect()` on the same `SPTAppRemote` instance.
  ///
  /// The `connectContinuation` is reused for the whole flow, so `didConnect()`
  /// / `didFailToConnect(error:)` resolve it exactly as for `connect()`.
  func authorizeAndPlay(uri: String, accessToken: String) async throws {
    if appRemote?.isConnected == true {
      if uri.isEmpty {
        try await playerResume()
      } else {
        try await playerPlay(uri: uri)
      }
      return
    }
    try await beginConnection(
      accessToken: accessToken,
      kickoff: .authorizeAndPlay(uri: uri),
    )
  }

  /// Consumes a redirect URL produced by an `authorizeAndPlay()` app-switch.
  /// Returns `true` if an authorize flow was pending and the URL was handled
  /// (so the AppDelegate should not also forward it to the auth coordinator).
  nonisolated func handleAuthorizeRedirect(_ url: URL) -> Bool {
    guard case .authorizeAndPlay = connectionAttempt?.kickoff,
          let remote = connectionAttempt?.remote
    else {
      return false
    }

    return SpotifyMainThread.run {
      let params = remote.authorizationParameters(from: url)
      if let token = params?[SPTAppRemoteAccessTokenKey] {
        remote.connectionParameters.accessToken = token
        clearConnectionAttempt()
        remote.connect()
        return true
      }
      if let errorDescription = params?[SPTAppRemoteErrorDescriptionKey] {
        clearConnectionAttempt()
        Task {
          await self.didFailToConnect(error: NSError(
            domain: "ExpoSpotifySDK",
            code: -2,
            userInfo: [NSLocalizedDescriptionKey: errorDescription]
          ))
        }
        return true
      }
      return false
    }
  }

  func disconnect() {
    if let cont = connectContinuation {
      connectContinuation = nil
      cont.resume(throwing: AppRemoteError.connectionFailed("Disconnected before connection completed"))
    }
    teardownPlayerSubscription()
    teardownCapabilitiesSubscription()
    appRemote?.disconnect()
    appRemote = nil
    clearConnectionAttempt()
    transitionState("disconnected")
  }

  nonisolated func isConnected() -> Bool {
    connectionStateString == "connected"
  }

  func getConnectionState() -> String {
    connectionStateString
  }

  func didConnect() {
    clearConnectionAttempt()
    transitionState("connected")
    setupPlayerSubscription()
    setupCapabilitiesSubscription()
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume()
  }

  func didFailToConnect(error: Error?) {
    appRemote = nil
    clearConnectionAttempt()
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

  // MARK: — Private connection helpers

  private func beginConnection(
    accessToken: String,
    kickoff: AppRemoteConnectionKickoff,
  ) async throws {
    guard connectContinuation == nil else {
      throw AppRemoteError.connectionFailed("A connection attempt is already in progress")
    }

    transitionState("connecting")

    let remote = makeAppRemote(accessToken: accessToken)
    appRemote = remote
    connectionAttempt = AppRemoteConnectionAttempt(remote: remote, kickoff: kickoff)

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      connectContinuation = cont
      Task { @MainActor in
        switch kickoff {
        case .directConnect:
          remote.connect()
        case .authorizeAndPlay(let uri):
          let success = await remote.authorizeAndPlayURI(uri)
          if !success {
            await self.didFailToConnect(error: Self.authorizeOpenFailedError())
          }
        }
      }
    }
  }

  private func makeAppRemote(accessToken: String) -> SPTAppRemote {
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
    remote.delegate = connectionBridge
    return remote
  }

  nonisolated private func clearConnectionAttempt() {
    connectionAttempt = nil
  }

  private static func authorizeOpenFailedError() -> NSError {
    NSError(
      domain: "ExpoSpotifySDK",
      code: -1,
      userInfo: [
        NSLocalizedDescriptionKey:
          "authorizeAndPlay: could not open the Spotify app (is it installed?)",
      ]
    )
  }
}

// MARK: — Connection delegate bridge

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
    NSLog("[ExpoSpotifySDK] AppRemote: connection failed — %@", safeLogSummary(for: error))
    Task { await coordinator?.didFailToConnect(error: error) }
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: (any Error)?) {
    NSLog("[ExpoSpotifySDK] AppRemote: disconnected — %@", safeLogSummary(for: error))
    Task { await coordinator?.didDisconnect(error: error) }
  }
}
