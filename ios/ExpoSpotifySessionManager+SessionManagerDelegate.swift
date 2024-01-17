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
}
