import Foundation
import SpotifyiOS

extension ExpoSpotifySessionManager: SPTSessionManagerDelegate {
    public func sessionManager(manager _: SPTSessionManager, didInitiate session: SPTSession) {
        if shouldRequestAccessToken {
            authPromiseSeal?.fulfill(AuthenticationResult.session(session))
        }
    }
    
    public func sessionManager(manager _: SPTSessionManager, didFailWith error: Error) {
        authPromiseSeal?.reject(error)
    }
    
    public func sessionManager(manager _: SPTSessionManager, didRenew session: SPTSession) {
        authPromiseSeal?.fulfill(AuthenticationResult.session(session))
    }
    
    public func sessionManager(manager: SPTSessionManager, shouldRequestAccessTokenWith code: String) -> Bool {
        if !shouldRequestAccessToken {
            authPromiseSeal?.fulfill(AuthenticationResult.authorizationCode(code))
        }
        
        return shouldRequestAccessToken
    }
}
