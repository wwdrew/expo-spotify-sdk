import ExpoModulesCore
import SpotifyiOS

private let SDK_VERSION = "0.8.0" // x-release-please-version
private let EVENT_SESSION_CHANGE = "onSessionChange"
private let EVENT_CONNECTION_STATE_CHANGE = "onConnectionStateChange"
private let EVENT_CONNECTION_ERROR = "onConnectionError"
private let EVENT_PLAYER_STATE_CHANGE = "onPlayerStateChange"

public class ExpoSpotifySDKModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSpotifySDK")

    Events(
      EVENT_SESSION_CHANGE,
      EVENT_CONNECTION_STATE_CHANGE,
      EVENT_CONNECTION_ERROR,
      EVENT_PLAYER_STATE_CHANGE
    )

    // Wire up App Remote coordinator event callbacks once the module is alive.
    OnCreate {
      SpotifyAppRemoteCoordinator.shared?.onConnectionStateChange = { [weak self] state in
        self?.sendEvent(EVENT_CONNECTION_STATE_CHANGE, ["state": state])
      }
      SpotifyAppRemoteCoordinator.shared?.onConnectionError = { [weak self] code, message in
        self?.sendEvent(EVENT_CONNECTION_ERROR, ["code": code, "message": message])
      }
      SpotifyAppRemoteCoordinator.shared?.onPlayerStateChange = { [weak self] stateMap in
        self?.sendEvent(EVENT_PLAYER_STATE_CHANGE, stateMap)
      }
    }

    // MARK: — Auth

    Function("isAvailable") { () -> Bool in
      SpotifyAuthCoordinator.shared?.isSpotifyAppInstalled() ?? false
    }

    AsyncFunction("cancelPendingAuthAsync") { () async -> Void in
      await SpotifyAuthCoordinator.shared?.cancelPending()
    }

    AsyncFunction("authenticateAsync") { (config: AuthenticateOptions) async throws -> [String: Any?] in
      do {
        guard let coordinator = SpotifyAuthCoordinator.shared else {
          throw SpotifyError.invalidConfiguration(
            "Missing `ExpoSpotifySDK` configuration in Info.plist. " +
            "Did you add @wwdrew/expo-spotify-sdk to your Expo plugins?"
          )
        }
        if config.scopes.isEmpty {
          throw SpotifyError.invalidConfiguration("`scopes` must contain at least one entry")
        }
        let scopes = SPTScopeSerializer.deserialize(config.scopes)
        let session = try await coordinator.authenticate(
          scopes: scopes,
          tokenSwapURL: config.tokenSwapURL.flatMap(URL.init),
          tokenRefreshURL: config.tokenRefreshURL.flatMap(URL.init),
          showDialog: config.showDialog
        )
        let map = self.sessionToMap(session)
        self.sendEvent(EVENT_SESSION_CHANGE, ["type": "didInitiate", "session": map])
        return map
      } catch let error as SpotifyError {
        self.sendEvent(EVENT_SESSION_CHANGE, [
          "type": "didFail",
          "error": ["code": error.code, "message": error.message],
        ])
        throw SpotifyAuthException(error)
      }
    }

    AsyncFunction("refreshSessionAsync") { (options: RefreshOptions) async throws -> [String: Any?] in
      do {
        guard let configuration = ExpoSpotifyConfiguration.fromInfoPlist() else {
          throw SpotifyError.invalidConfiguration(
            "Missing `ExpoSpotifySDK` configuration in Info.plist."
          )
        }
        if options.refreshToken.isEmpty {
          throw SpotifyError.invalidConfiguration("`refreshToken` is required")
        }
        if options.tokenRefreshURL.isEmpty {
          throw SpotifyError.invalidConfiguration("`tokenRefreshURL` is required")
        }
        let client = SpotifyTokenRefreshClient(sdkVersion: SDK_VERSION, clientID: configuration.clientID)
        let result = try await client.refresh(
          refreshToken: options.refreshToken,
          tokenRefreshURL: options.tokenRefreshURL,
          previousScopes: options.scopes
        )
        let map: [String: Any?] = [
          "accessToken": result.accessToken,
          "refreshToken": result.refreshToken,
          "expirationDate": result.expirationDate,
          "scopes": result.scopes,
        ]
        self.sendEvent(EVENT_SESSION_CHANGE, ["type": "didRenew", "session": map])
        return map
      } catch let error as SpotifyError {
        self.sendEvent(EVENT_SESSION_CHANGE, [
          "type": "didFail",
          "error": ["code": error.code, "message": error.message],
        ])
        throw SpotifyAuthException(error)
      } catch let error as SpotifyRefreshError {
        self.sendEvent(EVENT_SESSION_CHANGE, [
          "type": "didFail",
          "error": ["code": error.code, "message": error.message],
        ])
        throw SpotifyRefreshException(error)
      }
    }

    // MARK: — App Remote

    AsyncFunction("appRemoteConnect") { (accessToken: String) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw AppRemoteException(AppRemoteError.connectionFailed(
          "Missing `ExpoSpotifySDK` configuration in Info.plist."
        ))
      }
      do {
        try await coordinator.connect(accessToken: accessToken)
      } catch let error as AppRemoteError {
        throw AppRemoteException(error)
      }
    }

    AsyncFunction("appRemoteDisconnect") { () async -> Void in
      await SpotifyAppRemoteCoordinator.shared?.disconnect()
    }

    Function("appRemoteIsConnected") { () -> Bool in
      SpotifyAppRemoteCoordinator.shared?.isConnected() ?? false
    }

    AsyncFunction("appRemoteGetConnectionState") { () async -> String in
      await SpotifyAppRemoteCoordinator.shared?.getConnectionState() ?? "disconnected"
    }

    // MARK: — Player

    AsyncFunction("playerPlay") { (uri: String) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.play: missing configuration"))
      }
      do { try await coordinator.playerPlay(uri: uri) } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerPause") { () async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.pause: missing configuration"))
      }
      do { try await coordinator.playerPause() } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerResume") { () async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.resume: missing configuration"))
      }
      do { try await coordinator.playerResume() } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSkipNext") { () async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.skipNext: missing configuration"))
      }
      do { try await coordinator.playerSkipNext() } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSkipPrevious") { () async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.skipPrevious: missing configuration"))
      }
      do { try await coordinator.playerSkipPrevious() } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSeekTo") { (positionMs: Int) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.seekTo: missing configuration"))
      }
      do { try await coordinator.playerSeekTo(positionMs: positionMs) } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSetShuffle") { (enabled: Bool) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.setShuffle: missing configuration"))
      }
      do { try await coordinator.playerSetShuffle(enabled: enabled) } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSetRepeatMode") { (mode: Int) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.setRepeatMode: missing configuration"))
      }
      do { try await coordinator.playerSetRepeatMode(mode: mode) } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerSetPodcastPlaybackSpeed") { (value: Double) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.setPodcastPlaybackSpeed: missing configuration"))
      }
      do {
        try await coordinator.playerSetPodcastPlaybackSpeed(value: Float(value))
      } catch let e as NativePlayerError {
        throw PlayerException(e)
      }
    }

    AsyncFunction("playerQueue") { (uri: String) async throws -> Void in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.queue: missing configuration"))
      }
      do { try await coordinator.playerQueue(uri: uri) } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerGetPlayerState") { () async throws -> [String: Any] in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.getPlayerState: missing configuration"))
      }
      do { return try await coordinator.playerGetPlayerState() } catch let e as NativePlayerError { throw PlayerException(e) }
    }

    AsyncFunction("playerGetCrossfadeState") { () async throws -> [String: Any] in
      guard let coordinator = SpotifyAppRemoteCoordinator.shared else {
        throw PlayerException(NativePlayerError.notConnected("Player.getCrossfadeState: missing configuration"))
      }
      do { return try await coordinator.playerGetCrossfadeState() } catch let e as NativePlayerError { throw PlayerException(e) }
    }
  }

  // MARK: — Helpers

  private func sessionToMap(_ session: SPTSession) -> [String: Any?] {
    return [
      "accessToken": session.accessToken,
      "refreshToken": session.refreshToken.isEmpty ? nil : session.refreshToken,
      "expirationDate": Int(session.expirationDate.timeIntervalSince1970 * 1000),
      "scopes": SPTScopeSerializer.serialize(session.scope),
    ]
  }
}

// MARK: — Record types

struct AuthenticateOptions: Record {
  @Field var scopes: [String] = []
  @Field var tokenSwapURL: String? = nil
  @Field var tokenRefreshURL: String? = nil
  @Field var showDialog: Bool = false
}

struct RefreshOptions: Record {
  @Field var refreshToken: String = ""
  @Field var tokenRefreshURL: String = ""
  @Field var scopes: [String] = []
}
