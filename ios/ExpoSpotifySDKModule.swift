import ExpoModulesCore
import SpotifyiOS

public class ExpoSpotifySDKModule: Module {


    public func definition() -> ModuleDefinition {

        let spotifySession = ExpoSpotifySessionManager.shared

        Name("ExpoSpotifySDK")

        Function("isAvailable") {
            return spotifySession.spotifyAppInstalled()
        }

        AsyncFunction("authenticateAsync") { (scopes: [String], promise: Promise) in
            spotifySession.authenticate(requestedScopes: scopes).done { session in
                let sessionData: [String: Any] = [
                    "accessToken": session.accessToken,
                    "refreshToken": session.refreshToken,
                    "expirationDate": Int(session.expirationDate.timeIntervalSince1970 * 1000),
                    "scopes": SPTScopeSerializer.serializeScopes(session.scope),
                    "isExpired": session.isExpired
                ]
                promise.resolve(sessionData)
            }.catch { error in
                promise.reject(error)
            }
        }
    }
}
