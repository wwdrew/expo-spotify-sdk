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
            guard let scopes = config["scopes"] as? [String] else {
                promise.reject("INVALID_CONFIG", "Invalid SpotifyConfig object")
                return
            }
            
            let tokenSwapURL = config["tokenSwapURL"] as? String
            let tokenRefreshURL = config["tokenRefreshURL"] as? String
            let shouldRequestAccessToken = config["shouldRequestAccessToken"] as? Bool ?? true
            
            spotifySession.authenticate(scopes: scopes, tokenSwapURL: tokenSwapURL, tokenRefreshURL: tokenRefreshURL, shouldRequestAccessToken: shouldRequestAccessToken).done { result in
                switch result {
                case .session(let session):
                    promise.resolve([
                        "accessToken": session.accessToken,
                        "refreshToken": session.refreshToken,
                        "expirationDate": Int(session.expirationDate.timeIntervalSince1970 * 1000),
                        "scopes": SPTScopeSerializer.serializeScopes(session.scope),
                        "isExpired": session.isExpired
                    ])
                case .authorizationCode(let code):
                    promise.resolve(["code": code])
                }
            }.catch { error in
                promise.reject(error)
            }
        }
        
    }
}
