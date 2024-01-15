import SpotifyiOS

struct ExpoSpotifyConfiguration: Codable {
    let clientID: String
    let host: String
    let scheme: String
    
    var redirectURL: URL? {
        return URL(string: "\(scheme)://\(host)")
    }
    
    init(clientID: String = "defaultClientID",
         host: String = "defaultHost",
         scheme: String = "defaultScheme"
    ) {
        self.clientID = clientID
        self.host = host
        self.scheme = scheme
    }
}
