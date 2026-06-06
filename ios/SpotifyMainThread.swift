import Foundation

/// Runs a block on the main thread, matching AppDelegate / SceneDelegate redirect
/// hooks that require a synchronous result from the main actor.
enum SpotifyMainThread {
  static func run<T>(_ block: @MainActor () -> T) -> T {
    if Thread.isMainThread {
      return MainActor.assumeIsolated(block)
    }
    return DispatchQueue.main.sync {
      MainActor.assumeIsolated(block)
    }
  }
}
