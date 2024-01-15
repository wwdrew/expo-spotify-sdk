import ExpoModulesCore
import SpotifyiOS

public class ExpoSpotifySDKModule: Module {
    
    
    public func definition() -> ModuleDefinition {
        
        let spotifySession = ExpoSpotifySessionManager.shared
        
        Name("ExpoSpotifySDK")
        
        Function("isAvailable") {
            return spotifySession.spotifyAppInstalled()
        }
        
        AsyncFunction("authenticateAsync") { (config: [String: Any], promise: Promise) in
            guard let clientId = config["clientId"] as? String,
                  let scopes = config["scopes"] as? [String] else {
                promise.reject("INVALID_CONFIG", "Invalid SpotifyConfig object")
                return
            }
            
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
