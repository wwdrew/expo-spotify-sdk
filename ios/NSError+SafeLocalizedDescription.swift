import Foundation

extension NSError {
  /// `NSError.localizedDescription` force-bridges `userInfo[NSLocalizedDescriptionKey]`
  /// to `String`. When that value is a non-`String` object (Spotify's SDK can deliver an
  /// empty `__NSDictionary0`), the bridge sends `-length` to a dictionary and aborts.
  var safeLocalizedDescription: String {
    guard let value = userInfo[NSLocalizedDescriptionKey] else {
      return localizedDescription
    }
    return (value as? String) ?? ""
  }

  /// Same force-bridge hazard as `localizedDescription`, but for
  /// `NSLocalizedFailureReasonErrorKey`.
  var safeLocalizedFailureReason: String? {
    guard let value = userInfo[NSLocalizedFailureReasonErrorKey] else {
      return localizedFailureReason
    }
    return value as? String
  }
}

extension Error {
  /// Summary for logging that avoids `String(describing:)` / `localizedDescription`
  /// force-bridges on poisoned `userInfo` values.
  var safeLogSummary: String {
    let nsError = self as NSError
    let description = nsError.safeLocalizedDescription
    if description.isEmpty {
      return "\(nsError.domain) code \(nsError.code)"
    }
    return "\(nsError.domain) code \(nsError.code): \(description)"
  }
}

func safeLogSummary(for error: (any Error)?) -> String {
  guard let error else { return "nil" }
  return error.safeLogSummary
}
