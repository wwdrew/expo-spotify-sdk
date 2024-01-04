import ExpoModulesCore
import SpotifyiOS

final class ExpoSpotifySessionManager: NSObject, SPTSessionManagerDelegate {
    weak var module: ExpoSpotifySDKModule?

    static let shared = ExpoSpotifySessionManager()

    private var expoSpotifyConfiguration: ExpoSpotifyConfiguration? {
        if let expoSpotifySdkDict = Bundle.main.object(forInfoDictionaryKey: "ExpoSpotifySDK") as? [String: String],
           let clientID = expoSpotifySdkDict["clientID"],
           let host = expoSpotifySdkDict["host"],
           let scheme = expoSpotifySdkDict["scheme"],
           let tokenRefreshURLString = expoSpotifySdkDict["tokenRefreshURL"],
           let tokenRefreshURL = URL(string: tokenRefreshURLString),
           let tokenSwapURLString = expoSpotifySdkDict["tokenSwapURL"],
           let tokenSwapURL = URL(string: tokenSwapURLString)
        {
            return ExpoSpotifyConfiguration(clientID: clientID, host: host, scheme: scheme, tokenRefreshURL: tokenRefreshURL, tokenSwapURL: tokenSwapURL)
        } else {
            return nil
        }
    }

    lazy var configuration: SPTConfiguration = {
        guard let clientID = expoSpotifyConfiguration?.clientID,
              let redirectURL = expoSpotifyConfiguration?.redirectURL,
              let tokenRefreshURL = expoSpotifyConfiguration?.tokenRefreshURL,
              let tokenSwapURL = expoSpotifyConfiguration?.tokenSwapURL else {
            fatalError("Invalid Spotify configuration")
        }

        let configuration = SPTConfiguration(clientID: clientID, redirectURL: redirectURL)

        configuration.tokenSwapURL = tokenRefreshURL
        configuration.tokenRefreshURL = tokenSwapURL

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
