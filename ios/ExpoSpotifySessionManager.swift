import ExpoModulesCore
import SpotifyiOS

final class ExpoSpotifySessionManager: NSObject, SPTSessionManagerDelegate {
    weak var module: ExpoSpotifySDKModule?
    
    static let shared = ExpoSpotifySessionManager()
    
    private let SpotifyClientID = "<#ClientID#>"
    private let SpotifyRedirectURI = URL(string: "spotify-login-sdk-test-app://spotify-login-callback")!
    
    lazy var configuration: SPTConfiguration = {
        let configuration = SPTConfiguration(clientID: SpotifyClientID, redirectURL: SpotifyRedirectURI)
        // Set these url's to your backend which contains the secret to exchange for an access token
        // You can use the provided ruby script spotify_token_swap.rb for testing purposes
        configuration.tokenSwapURL = URL(string: "http://localhost:1234/swap")
        configuration.tokenRefreshURL = URL(string: "http://localhost:1234/refresh")
        
        return configuration
    }()
    
    lazy var sessionManager: SPTSessionManager = {
        return SPTSessionManager(configuration: configuration, delegate: self)
    }()
    
    func spotifyAppInstalled() -> Bool {
        var isInstalled = false

        DispatchQueue.main.sync {
            isInstalled = sessionManager.isSpotifyAppInstalled
        }

        return isInstalled
    }
    
    func sessionManager(manager: SPTSessionManager, didInitiate session: SPTSession) {
        
    }
    
    func sessionManager(manager: SPTSessionManager, didFailWith error: Error) {
        
    }
    
}
