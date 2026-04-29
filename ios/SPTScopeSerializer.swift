import Foundation
import SpotifyiOS

enum SPTScopeSerializer {
  /// Single source of truth for the string ↔ SPTScope mapping. Order is
  /// preserved on round-trip via `serialize` (sorted alphabetically) so output
  /// is deterministic.
  static let scopeMap: [(String, SPTScope)] = [
    ("app-remote-control", .appRemoteControl),
    ("playlist-modify-private", .playlistModifyPrivate),
    ("playlist-modify-public", .playlistModifyPublic),
    ("playlist-read-collaborative", .playlistReadCollaborative),
    ("playlist-read-private", .playlistReadPrivate),
    ("streaming", .streaming),
    ("ugc-image-upload", .ugcImageUpload),
    ("user-follow-modify", .userFollowModify),
    ("user-follow-read", .userFollowRead),
    ("user-library-modify", .userLibraryModify),
    ("user-library-read", .userLibraryRead),
    ("user-modify-playback-state", .userModifyPlaybackState),
    ("user-read-currently-playing", .userReadCurrentlyPlaying),
    ("user-read-email", .userReadEmail),
    ("user-read-playback-state", .userReadPlaybackState),
    ("user-read-private", .userReadPrivate),
    ("user-read-recently-played", .userReadRecentlyPlayed),
    ("user-top-read", .userTopRead),
  ]

  static func serialize(_ scopes: SPTScope) -> [String] {
    scopeMap.compactMap { (string, value) in
      scopes.contains(value) ? string : nil
    }
  }

  static func deserialize(_ scopes: [String]) -> SPTScope {
    var result: SPTScope = []
    let lookup = Dictionary(uniqueKeysWithValues: scopeMap)
    for string in scopes {
      if let value = lookup[string] {
        result.insert(value)
      }
    }
    return result
  }
}
