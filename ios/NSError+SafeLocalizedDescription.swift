import Foundation

extension NSError {
  /// `NSError.localizedDescription` force-bridges `userInfo[NSLocalizedDescriptionKey]`
  /// to `String`. When that value is a non-`String` object (Spotify's SDK can deliver an
  /// empty `__NSDictionary0`), the bridge sends `-length` to a dictionary and aborts.
  var safeLocalizedDescription: String {
    if let value = userInfo[NSLocalizedDescriptionKey], !(value is String) {
      return ""
    }
    return localizedDescription
  }

  /// Same force-bridge hazard as `localizedDescription`, but for
  /// `NSLocalizedFailureReasonErrorKey`.
  var safeLocalizedFailureReason: String? {
    if let value = userInfo[NSLocalizedFailureReasonErrorKey], !(value is String) {
      return nil
    }
    return localizedFailureReason
  }
}
