import SpotifyiOS

class SPTScopeSerializer {
    static let scopeMap: [String: SPTScope] = [
        "playlist-read-private": .playlistReadPrivate,
        "playlist-read-collaborative": .playlistReadCollaborative,
        "playlist-modify-public": .playlistModifyPublic,
        "playlist-modify-private": .playlistModifyPrivate,
        "user-follow-read": .userFollowRead,
        "user-follow-modify": .userFollowModify,
        "user-library-read": .userLibraryRead,
        "user-library-modify": .userLibraryModify,
        "user-read-email": .userReadEmail,
        "user-read-private": .userReadPrivate,
        "user-top-read": .userTopRead,
        "ugc-image-upload": .ugcImageUpload,
        "streaming": .streaming,
        "app-remote-control": .appRemoteControl,
        "user-read-playback-state": .userReadPlaybackState,
        "user-modify-playback-state": .userModifyPlaybackState,
        "user-read-currently-playing": .userReadCurrentlyPlaying,
        "user-read-recently-played": .userReadRecentlyPlayed,
    ]
    
    static func serializeScopes(_ scopes: SPTScope) -> [String] {
        var serializedScopes = [String]()
        for (scopeString, scopeValue) in scopeMap {
            if scopes.contains(scopeValue) {
                serializedScopes.append(scopeString)
            }
        }
        return serializedScopes
    }
    
    static func deserializeScopes(_ scopes: [String]) -> SPTScope {
        var deserializedScopes: SPTScope = []
        for scopeString in scopes {
            if let scopeValue = scopeMap[scopeString] {
                deserializedScopes.insert(scopeValue)
            }
        }
        return deserializedScopes
    }
}
