import ExpoModulesCore
import SpotifyiOS

public class ExpoSpotifyAuthDelegate: ExpoAppDelegateSubscriber {
    let sessionManager = ExpoSpotifySessionManager.shared

    public func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        sessionManager.sessionManager?.application(app, open: url, options: options)
        return true
    }
}
