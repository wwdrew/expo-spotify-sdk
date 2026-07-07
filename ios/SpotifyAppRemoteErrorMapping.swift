import Foundation
import SpotifyiOS

/// Maps `SPTAppRemote` NSError payloads into per-namespace native error enums.
/// Keep aligned with [docs/app-remote-error-mapping.md](../docs/app-remote-error-mapping.md).
enum SpotifyAppRemoteErrorMapping {
  private static func isSPTError(_ error: NSError) -> Bool {
    error.domain == SPTAppRemoteErrorDomain
  }

  private static func isConnectionTerminated(_ error: NSError) -> Bool {
    isSPTError(error) && error.code == SPTAppRemoteErrorCode.connectionTerminatedError.rawValue
  }

  private static func isInvalidArguments(_ error: NSError) -> Bool {
    isSPTError(error) && error.code == SPTAppRemoteErrorCode.invalidArgumentsError.rawValue
  }

  private static func isRequestFailed(_ error: NSError) -> Bool {
    isSPTError(error) && error.code == SPTAppRemoteErrorCode.requestFailedError.rawValue
  }

  private static func connectionLostMessage(callsite: String) -> String {
    "\(callsite): connection to Spotify app was terminated"
  }

  private static func containsRestriction(_ description: String) -> Bool {
    let desc = description.lowercased()
    return desc.contains("not allowed") || desc.contains("restriction")
  }

  static func mapPlayerError(_ error: NSError, callsite: String) -> NativePlayerError {
    let desc = error.safeLocalizedDescription
    guard isSPTError(error) else {
      return .unknown(desc)
    }
    if isConnectionTerminated(error) {
      return .connectionLost(connectionLostMessage(callsite: callsite))
    }
    if isInvalidArguments(error) {
      let lower = desc.lowercased()
      if lower.contains("uri") {
        return .invalidURI("\(callsite): \(desc)")
      }
      return .invalidParameter(desc)
    }
    if isRequestFailed(error) {
      let lower = desc.lowercased()
      if lower.contains("premium") {
        return .premiumRequired("\(callsite): Spotify Premium is required for on-demand playback")
      }
      if containsRestriction(desc) {
        return .operationNotAllowed("\(callsite): \(desc)")
      }
      return .unknown(desc)
    }
    return .unknown(desc)
  }

  static func mapUserError(_ error: NSError, callsite: String) -> NativeUserError {
    let desc = error.safeLocalizedDescription
    guard isSPTError(error) else {
      return .unknown(desc)
    }
    if isConnectionTerminated(error) {
      return .connectionLost(connectionLostMessage(callsite: callsite))
    }
    if isInvalidArguments(error) {
      return .invalidURI("\(callsite): \(desc)")
    }
    if isRequestFailed(error) {
      if containsRestriction(desc) {
        return .operationNotAllowed("\(callsite): \(desc)")
      }
      return .unknown(desc)
    }
    return .unknown(desc)
  }

  static func mapContentError(_ error: NSError, callsite: String) -> NativeContentError {
    let desc = error.safeLocalizedDescription
    guard isSPTError(error) else {
      return .unknown(desc)
    }
    if isConnectionTerminated(error) {
      return .connectionLost(connectionLostMessage(callsite: callsite))
    }
    if isRequestFailed(error) {
      let lower = desc.lowercased()
      if lower.contains("not supported") || lower.contains("unsupported") {
        return .contentAPIUnavailable("\(callsite): content API is unavailable on this Spotify app version")
      }
      return .unknown(desc)
    }
    return .unknown(desc)
  }

  static func mapImagesError(_ error: NSError, callsite: String) -> NativeImagesError {
    let desc = error.safeLocalizedDescription
    guard isSPTError(error) else {
      return .unknown(desc)
    }
    if isConnectionTerminated(error) {
      return .notConnected(connectionLostMessage(callsite: callsite))
    }
    if isInvalidArguments(error) {
      return .invalidURI("\(callsite): invalid image identifier")
    }
    if isRequestFailed(error) {
      return .imageLoadFailed("\(callsite): Spotify rejected image request")
    }
    return .unknown(desc)
  }
}
