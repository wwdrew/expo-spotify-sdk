import ExpoModulesCore
import Foundation

// MARK: — App Remote error types

enum AppRemoteError: Error {
  case connectionFailed(String)
  case connectionLost(String)
  case notConnected(String)
  case unknown(String)

  var code: String {
    switch self {
    case .connectionFailed: return "CONNECTION_FAILED"
    case .connectionLost: return "CONNECTION_LOST"
    case .notConnected: return "NOT_CONNECTED"
    case .unknown: return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .connectionFailed(let m): return m
    case .connectionLost(let m): return m
    case .notConnected(let m): return m
    case .unknown(let m): return m
    }
  }
}

/// Bridges an `AppRemoteError` through expo-modules-core's exception system so
/// JS callers receive a structured `code` and `reason`, not "undefined reason".
final class AppRemoteException: Exception, @unchecked Sendable {
  private let appRemoteCode: String
  private let appRemoteMessage: String

  init(_ error: AppRemoteError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.appRemoteCode = error.code
    self.appRemoteMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { appRemoteCode }
  override var reason: String { appRemoteMessage }
}

// MARK: — Player error types

enum NativePlayerError: Error {
  case notConnected(String)
  case connectionLost(String)
  case premiumRequired(String)
  case invalidURI(String)
  case invalidParameter(String)
  case operationNotAllowed(String)
  case unknown(String)

  var code: String {
    switch self {
    case .notConnected: return "NOT_CONNECTED"
    case .connectionLost: return "CONNECTION_LOST"
    case .premiumRequired: return "PREMIUM_REQUIRED"
    case .invalidURI: return "INVALID_URI"
    case .invalidParameter: return "INVALID_PARAMETER"
    case .operationNotAllowed: return "OPERATION_NOT_ALLOWED"
    case .unknown: return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m): return m
    case .connectionLost(let m): return m
    case .premiumRequired(let m): return m
    case .invalidURI(let m): return m
    case .invalidParameter(let m): return m
    case .operationNotAllowed(let m): return m
    case .unknown(let m): return m
    }
  }
}

final class PlayerException: Exception, @unchecked Sendable {
  private let playerCode: String
  private let playerMessage: String

  init(_ error: NativePlayerError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.playerCode = error.code
    self.playerMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { playerCode }
  override var reason: String { playerMessage }
}

// MARK: — User error types

enum NativeUserError: Error {
  case notConnected(String)
  case connectionLost(String)
  case invalidURI(String)
  case operationNotAllowed(String)
  case unknown(String)

  var code: String {
    switch self {
    case .notConnected: return "NOT_CONNECTED"
    case .connectionLost: return "CONNECTION_LOST"
    case .invalidURI: return "INVALID_URI"
    case .operationNotAllowed: return "OPERATION_NOT_ALLOWED"
    case .unknown: return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m): return m
    case .connectionLost(let m): return m
    case .invalidURI(let m): return m
    case .operationNotAllowed(let m): return m
    case .unknown(let m): return m
    }
  }
}

final class UserException: Exception, @unchecked Sendable {
  private let userCode: String
  private let userMessage: String

  init(_ error: NativeUserError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.userCode = error.code
    self.userMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { userCode }
  override var reason: String { userMessage }
}

// MARK: — Content error types

enum NativeContentError: Error {
  case notConnected(String)
  case connectionLost(String)
  case contentAPIUnavailable(String)
  case unknown(String)

  var code: String {
    switch self {
    case .notConnected: return "NOT_CONNECTED"
    case .connectionLost: return "CONNECTION_LOST"
    case .contentAPIUnavailable: return "CONTENT_API_UNAVAILABLE"
    case .unknown: return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m): return m
    case .connectionLost(let m): return m
    case .contentAPIUnavailable(let m): return m
    case .unknown(let m): return m
    }
  }
}

final class ContentException: Exception, @unchecked Sendable {
  private let contentCode: String
  private let contentMessage: String

  init(_ error: NativeContentError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.contentCode = error.code
    self.contentMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { contentCode }
  override var reason: String { contentMessage }
}

// MARK: — Images error types

enum NativeImagesError: Error {
  case notConnected(String)
  case invalidURI(String)
  case imageLoadFailed(String)
  case unknown(String)

  var code: String {
    switch self {
    case .notConnected: return "NOT_CONNECTED"
    case .invalidURI: return "INVALID_URI"
    case .imageLoadFailed: return "IMAGE_LOAD_FAILED"
    case .unknown: return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m): return m
    case .invalidURI(let m): return m
    case .imageLoadFailed(let m): return m
    case .unknown(let m): return m
    }
  }
}

final class ImagesException: Exception, @unchecked Sendable {
  private let imagesCode: String
  private let imagesMessage: String

  init(_ error: NativeImagesError, file: String = #fileID, line: UInt = #line, function: String = #function) {
    self.imagesCode = error.code
    self.imagesMessage = error.message
    super.init(file: file, line: line, function: function)
  }

  override var code: String { imagesCode }
  override var reason: String { imagesMessage }
}
