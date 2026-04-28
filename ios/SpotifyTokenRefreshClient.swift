import Foundation

enum SpotifyRefreshError: Error {
  case invalidURL(String)
  case network(Error)
  case http(status: Int, body: String?)
  case parse(String)

  var code: String {
    switch self {
    case .invalidURL:  return "INVALID_CONFIG"
    case .network:     return "NETWORK_ERROR"
    case .http:        return "TOKEN_SWAP_FAILED"
    case .parse:       return "TOKEN_SWAP_PARSE_ERROR"
    }
  }

  var message: String {
    switch self {
    case .invalidURL(let s):
      return "Invalid token refresh URL: \(s)"
    case .network(let err):
      return err.localizedDescription
    case .http(let status, let body):
      let trimmed = body.map { String($0.prefix(512)) } ?? ""
      return "Token refresh server returned HTTP \(status)\(trimmed.isEmpty ? "" : ": \(trimmed)")"
    case .parse(let m):
      return m
    }
  }
}

struct SpotifyRefreshResult {
  let accessToken: String
  let refreshToken: String?
  let expirationDate: Int64
  let scopes: [String]
}

struct SpotifyTokenRefreshClient {
  let sdkVersion: String
  let clientID: String
  let session: URLSession

  init(sdkVersion: String, clientID: String, session: URLSession = .shared) {
    self.sdkVersion = sdkVersion
    self.clientID = clientID
    self.session = session
  }

  func refresh(
    refreshToken: String,
    tokenRefreshURL urlString: String,
    previousScopes: [String]
  ) async throws -> SpotifyRefreshResult {
    guard let url = URL(string: urlString) else {
      throw SpotifyRefreshError.invalidURL(urlString)
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.setValue("expo-spotify-sdk/\(sdkVersion)", forHTTPHeaderField: "User-Agent")
    request.httpBody = formURLEncoded([
      "refresh_token": refreshToken,
      "client_id": clientID,
    ]).data(using: .utf8)

    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await session.data(for: request)
    } catch {
      throw SpotifyRefreshError.network(error)
    }

    guard let http = response as? HTTPURLResponse else {
      throw SpotifyRefreshError.parse("Non-HTTP response from refresh endpoint")
    }
    guard (200..<300).contains(http.statusCode) else {
      let body = String(data: data, encoding: .utf8)
      throw SpotifyRefreshError.http(status: http.statusCode, body: body)
    }

    let json: [String: Any]
    do {
      guard let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw SpotifyRefreshError.parse("Refresh response was not a JSON object")
      }
      json = parsed
    } catch {
      throw SpotifyRefreshError.parse("Refresh response was not valid JSON: \(error.localizedDescription)")
    }

    guard let accessToken = (json["access_token"] as? String), !accessToken.isEmpty else {
      throw SpotifyRefreshError.parse("Refresh response missing required field: access_token")
    }
    guard let expiresIn = json["expires_in"] as? Int else {
      throw SpotifyRefreshError.parse("Refresh response missing required field: expires_in")
    }
    let rotatedRefreshToken = (json["refresh_token"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let scopeString = json["scope"] as? String
    let scopes = scopeString?.split(separator: " ").map(String.init) ?? previousScopes
    let expirationDate = Int64(Date().timeIntervalSince1970 * 1000) + Int64(expiresIn) * 1000

    return SpotifyRefreshResult(
      accessToken: accessToken,
      refreshToken: rotatedRefreshToken ?? refreshToken,
      expirationDate: expirationDate,
      scopes: scopes
    )
  }

  private func formURLEncoded(_ pairs: [String: String]) -> String {
    var components = URLComponents()
    components.queryItems = pairs.map { URLQueryItem(name: $0.key, value: $0.value) }
    return components.percentEncodedQuery ?? ""
  }
}
