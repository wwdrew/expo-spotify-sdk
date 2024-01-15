import ExpoModulesCore
import SpotifyiOS
import PromiseKit

enum SessionManagerError: Error {
    case notInitialized
    case invalidConfiguration
}

final class ExpoSpotifySessionManager: NSObject {
    weak var module: ExpoSpotifySDKModule?
    var authPromiseSeal: Resolver<SPTSession>?
    
    static let shared = ExpoSpotifySessionManager()
    
    private var expoSpotifyConfiguration: ExpoSpotifyConfiguration? {
        guard let expoSpotifySdkDict = Bundle.main.object(forInfoDictionaryKey: "ExpoSpotifySDK") as? [String: String],
              let clientID = expoSpotifySdkDict["clientID"],
              let host = expoSpotifySdkDict["host"],
              let scheme = expoSpotifySdkDict["scheme"] else
        {
            return nil
        }
        
        return ExpoSpotifyConfiguration(clientID: clientID, host: host, scheme: scheme)
    }
    
    lazy var configuration: SPTConfiguration? = {
        guard let clientID = expoSpotifyConfiguration?.clientID,
              let redirectURL = expoSpotifyConfiguration?.redirectURL else {
            NSLog("Invalid Spotify configuration")
            return nil
        }
        
        return SPTConfiguration(clientID: clientID, redirectURL: redirectURL)
    }()
    
    lazy var sessionManager: SPTSessionManager? = {
        guard let configuration = configuration else {
            return nil
        }
        
        return SPTSessionManager(configuration: configuration, delegate: self)
    }()
    
    
    func authenticate(scopes: [String], tokenSwapURL: String?, tokenRefreshURL: String?) -> PromiseKit.Promise<SPTSession> {
        return Promise { seal in
            guard let clientID = expoSpotifyConfiguration?.clientID,
                  let redirectURL = expoSpotifyConfiguration?.redirectURL else {
                NSLog("Invalid Spotify configuration")
                seal.reject(SessionManagerError.invalidConfiguration)
                return
            }
            let configuration = SPTConfiguration(clientID: clientID, redirectURL: redirectURL)

            configuration.tokenSwapURL = URL(string: tokenSwapURL ?? "")
            configuration.tokenRefreshURL = URL(string: tokenRefreshURL ?? "")
            
            self.sessionManager = SPTSessionManager(configuration: configuration, delegate: self)
            
            self.authPromiseSeal = seal
            
            DispatchQueue.main.sync {
                sessionManager?.initiateSession(with: SPTScopeSerializer.deserializeScopes(scopes), options: .default)
            }
        }
    }
    
    func spotifyAppInstalled() -> Bool {
        guard let sessionManager = sessionManager else {
            NSLog("SPTSessionManager not initialized")
            return false
        }
        
        var isInstalled = false
        
        DispatchQueue.main.sync {
            isInstalled = sessionManager.isSpotifyAppInstalled
        }
        
        return isInstalled
    }
}
