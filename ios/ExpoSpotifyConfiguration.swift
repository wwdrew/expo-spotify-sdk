import Foundation
import SpotifyiOS

/// Strongly-typed view of the `ExpoSpotifySDK` Info.plist dictionary written
/// by the Expo config plugin. Values are validated up-front; missing or empty
/// entries return nil so callers can fail with a structured error.
struct ExpoSpotifyConfiguration {
  let clientID: String
  let host: String
  let scheme: String

  var redirectURL: URL? {
    return URL(string: "\(scheme)://\(host)")
  }

  var sptConfiguration: SPTConfiguration? {
    guard let redirectURL = redirectURL else { return nil }
    return SPTConfiguration(clientID: clientID, redirectURL: redirectURL)
  }

  static func fromInfoPlist(bundle: Bundle = .main) -> ExpoSpotifyConfiguration? {
    guard let dict = bundle.object(forInfoDictionaryKey: "ExpoSpotifySDK") as? [String: Any] else {
      return nil
    }
    guard
      let clientID = (dict["clientID"] as? String)?.nilIfEmpty,
      let host = (dict["host"] as? String)?.nilIfEmpty,
      let scheme = (dict["scheme"] as? String)?.nilIfEmpty
    else {
      return nil
    }
    return ExpoSpotifyConfiguration(clientID: clientID, host: host, scheme: scheme)
  }
}

private extension String {
  var nilIfEmpty: String? { isEmpty ? nil : self }
}
