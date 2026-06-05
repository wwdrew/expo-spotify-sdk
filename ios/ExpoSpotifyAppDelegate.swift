import ExpoModulesCore
import SpotifyiOS

/// Delivers Spotify redirect URLs received via the legacy
/// `application(_:open:url:)` AppDelegate path.
public class ExpoSpotifyAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Both the auth flow (SPTSessionManager) and App Remote's
    // `authorizeAndPlay()` redirect through the same URL scheme. Offer the URL
    // to the App Remote coordinator first — it only claims the redirect when an
    // `authorizeAndPlay()` flow is actually pending — then fall back to auth.
    if SpotifyAppRemoteCoordinator.shared?.handleAuthorizeRedirect(url) == true {
      return true
    }
    return SpotifyAuthCoordinator.shared?.handleOpenURL(url, options: options) ?? false
  }
}
