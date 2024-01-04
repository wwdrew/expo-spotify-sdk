struct ExpoSpotifyConfiguration: Codable {
    let clientID: String
    let host: String
    let scheme: String
    let tokenRefreshURL: URL
    let tokenSwapURL: URL

    var redirectURL: URL? {
        return URL(string: "\(scheme)://\(host)")
    }

    init(clientID: String = "defaultClientID",
         host: String = "defaultHost",
         scheme: String = "defaultScheme",
         tokenRefreshURL: URL = URL(string: "http://defaultTokenRefreshURL")!,
         tokenSwapURL: URL = URL(string: "http://defaultTokenSwapURL")!) {
        self.clientID = clientID
        self.host = host
        self.scheme = scheme
        self.tokenRefreshURL = tokenRefreshURL
        self.tokenSwapURL = tokenSwapURL
    }
}
