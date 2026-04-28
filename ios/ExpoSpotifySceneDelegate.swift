import ExpoModulesCore
import SpotifyiOS

/// Delivers Spotify auth redirect URLs received via the modern Scene-based
/// `scene(_:openURLContexts:)` path. Per Spotify SDK 5.0+ guidance, we forward
/// the URL to `SPTSessionManager.application(_:open:url:options:)` with empty
/// options because `openURLContexts` does not provide compatible options.
public class ExpoSpotifySceneDelegate: ExpoSceneDelegateSubscriber {
  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = SpotifyAuthCoordinator.shared?.handleOpenURL(url, options: [:])
  }
}
