import ExpoModulesCore
import SpotifyiOS

private let SDK_VERSION = "0.5.0"
private let EVENT_SESSION_CHANGE = "onSessionChange"

public class ExpoSpotifySDKModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSpotifySDK")
    Events(EVENT_SESSION_CHANGE)

    Function("isAvailable") { () -> Bool in
      SpotifyAuthCoordinator.shared?.isSpotifyAppInstalled() ?? false
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
          tokenRefreshURL: config.tokenRefreshURL.flatMap(URL.init)
        )
        let map = self.sessionToMap(session)
        self.sendEvent(EVENT_SESSION_CHANGE, ["type": "didInitiate", "session": map])
        return map
      } catch let error as SpotifyError {
        self.sendEvent(EVENT_SESSION_CHANGE, [
          "type": "didFail",
          "error": ["code": error.code, "message": error.message],
        ])
        throw GenericException("\(error.code): \(error.message)")
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
          previousScopes: []
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
        throw GenericException("\(error.code): \(error.message)")
      } catch let error as SpotifyRefreshError {
        self.sendEvent(EVENT_SESSION_CHANGE, [
          "type": "didFail",
          "error": ["code": error.code, "message": error.message],
        ])
        throw GenericException("\(error.code): \(error.message)")
      }
    }
  }

  private func sessionToMap(_ session: SPTSession) -> [String: Any?] {
    return [
      "accessToken": session.accessToken,
      "refreshToken": session.refreshToken.isEmpty ? nil : session.refreshToken,
      "expirationDate": Int(session.expirationDate.timeIntervalSince1970 * 1000),
      "scopes": SPTScopeSerializer.serialize(session.scope),
    ]
  }
}

struct AuthenticateOptions: Record {
  @Field var scopes: [String] = []
  @Field var tokenSwapURL: String? = nil
  @Field var tokenRefreshURL: String? = nil
}

struct RefreshOptions: Record {
  @Field var refreshToken: String = ""
  @Field var tokenRefreshURL: String = ""
}
