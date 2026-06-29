import ExpoModulesCore
import Foundation

/// Public, structured errors thrown by the auth coordinator. Each case carries
/// the JS-facing error code in `code`, mirroring the Android `CodedException`
/// taxonomy. Raw `NSError`s are turned into these by
/// `SpotifyAuthErrorMapping.classify(_:context:)`.
enum SpotifyError: Error {
  case invalidConfiguration(String)
  case authInProgress
  case userCancelled
  case spotifyNotInstalled
  case networkError(message: String, cause: Error)
  case tokenSwapFailed(status: Int?, message: String, cause: Error)
  case tokenSwapParseError(message: String, cause: Error)
  case authError(message: String, cause: Error)
  case underlying(message: String, cause: Error)

  var code: String {
    switch self {
    case .invalidConfiguration: return "INVALID_CONFIG"
    case .authInProgress:       return "AUTH_IN_PROGRESS"
    case .userCancelled:        return "USER_CANCELLED"
    case .spotifyNotInstalled:  return "SPOTIFY_NOT_INSTALLED"
    case .networkError:         return "NETWORK_ERROR"
    case .tokenSwapFailed:      return "TOKEN_SWAP_FAILED"
    case .tokenSwapParseError:  return "TOKEN_SWAP_PARSE_ERROR"
    case .authError:            return "AUTH_ERROR"
    case .underlying:           return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .invalidConfiguration(let m):     return m
    case .authInProgress:                  return "Another authentication request is already in progress"
    case .userCancelled:                   return "Authentication was cancelled by the user"
    case .spotifyNotInstalled:             return "The Spotify app is not installed on this device"
    case .networkError(let message, _):    return message
    case .tokenSwapFailed(_, let message, _): return message
    case .tokenSwapParseError(let message, _): return message
    case .authError(let message, _):       return message
    case .underlying(let message, _):      return message
    }
  }

  /// The original error that caused this failure, if any. Surfaced as the
  /// JS-facing exception's `cause` so debugging / Sentry breadcrumbs keep the
  /// full chain rather than collapsing into "undefined reason".
  var underlyingCause: Error? {
    switch self {
    case .networkError(_, let cause): return cause
    case .tokenSwapFailed(_, _, let cause): return cause
    case .tokenSwapParseError(_, let cause): return cause
    case .authError(_, let cause): return cause
    case .underlying(_, let cause): return cause
    default:                        return nil
    }
  }
}

/// `Exception` subclass that projects a `SpotifyError`'s `code` and `message`
/// through `expo-modules-core`'s exception bridge so JS receives the structured
/// code and a meaningful reason — not the default "undefined reason" placeholder.
///
/// Without this wrapper an `AsyncFunction` rejection collapses to
/// `FunctionCallException` → `cause.reason = "undefined reason"` because the
/// previously-used `GenericException<String>` does not override `reason`.
final class SpotifyAuthException: Exception, @unchecked Sendable {
  private let spotifyCode: String
  private let spotifyMessage: String

  init(_ error: SpotifyError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.spotifyCode = error.code
    self.spotifyMessage = error.message
    super.init(file: file, line: line, function: function)
    self.cause = error.underlyingCause
  }

  override var code: String { spotifyCode }
  override var reason: String { spotifyMessage }
}
