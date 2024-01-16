import Foundation
import SpotifyiOS

extension ExpoSpotifySessionManager: SPTSessionManagerDelegate {
    public func sessionManager(manager _: SPTSessionManager, didInitiate session: SPTSession) {
        authPromiseSeal?.fulfill(session)
    }

    public func sessionManager(manager _: SPTSessionManager, didFailWith error: Error) {
        authPromiseSeal?.reject(error)
    }

    public func sessionManager(manager _: SPTSessionManager, didRenew session: SPTSession) {
        authPromiseSeal?.fulfill(session)
    }

    public func sessionManager(manager: SPTSessionManager, shouldRequestAccessTokenWith code: String) -> Bool {
        // Return true if you want the session manager to request an access token with the authorization code.
        // Otherwise, return false.
        return false
    }
}
