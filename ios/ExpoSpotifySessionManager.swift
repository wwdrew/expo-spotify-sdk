import ExpoModulesCore
import SpotifyiOS
import PromiseKit

enum SessionManagerError: Error {
    case notInitialized
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

        let tokenRefreshURL = URL(string: expoSpotifySdkDict["tokenRefreshURL"] ?? "")
        let tokenSwapURL = URL(string: expoSpotifySdkDict["tokenSwapURL"] ?? "")

        return ExpoSpotifyConfiguration(clientID: clientID, host: host, scheme: scheme, tokenRefreshURL: tokenRefreshURL, tokenSwapURL: tokenSwapURL)
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

        configuration.tokenSwapURL = expoSpotifyConfiguration?.tokenSwapURL
        configuration.tokenRefreshURL = expoSpotifyConfiguration?.tokenRefreshURL

        return SPTSessionManager(configuration: configuration, delegate: self)
    }()


    func authenticate(requestedScopes: [String]) -> PromiseKit.Promise<SPTSession> {
        return Promise { seal in
            guard let sessionManager = sessionManager else {
                NSLog("Session manager not initialized")
                seal.reject(SessionManagerError.notInitialized)
                return
            }

            self.authPromiseSeal = seal

            DispatchQueue.main.sync {
                sessionManager.initiateSession(with: SPTScopeSerializer.deserializeScopes(requestedScopes), options: .default)
            }
        }
    }

    func spotifyAppInstalled() -> Bool {
        guard let sessionManager = sessionManager else {
            NSLog("Session manager not initialized")
            return false
        }

        var isInstalled = false

        DispatchQueue.main.sync {
            isInstalled = sessionManager.isSpotifyAppInstalled
        }

        return isInstalled
    }
}
