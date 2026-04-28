import ExpoModulesCore
import SpotifyiOS

/// Delivers Spotify auth redirect URLs received via the legacy
/// `application(_:open:url:)` AppDelegate path.
public class ExpoSpotifyAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return SpotifyAuthCoordinator.shared?.handleOpenURL(url, options: options) ?? false
  }
}
