import ExpoModulesCore
import Foundation
import SpotifyiOS
import UIKit

// MARK: — App Remote error types

enum AppRemoteError: Error {
  case connectionFailed(String)
  case connectionLost(String)
  case notConnected(String)
  case unknown(String)

  var code: String {
    switch self {
    case .connectionFailed: return "CONNECTION_FAILED"
    case .connectionLost:   return "CONNECTION_LOST"
    case .notConnected:     return "NOT_CONNECTED"
    case .unknown:          return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .connectionFailed(let m): return m
    case .connectionLost(let m):   return m
    case .notConnected(let m):     return m
    case .unknown(let m):          return m
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
    case .notConnected:        return "NOT_CONNECTED"
    case .connectionLost:      return "CONNECTION_LOST"
    case .premiumRequired:     return "PREMIUM_REQUIRED"
    case .invalidURI:          return "INVALID_URI"
    case .invalidParameter:    return "INVALID_PARAMETER"
    case .operationNotAllowed: return "OPERATION_NOT_ALLOWED"
    case .unknown:             return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m):        return m
    case .connectionLost(let m):      return m
    case .premiumRequired(let m):     return m
    case .invalidURI(let m):          return m
    case .invalidParameter(let m):    return m
    case .operationNotAllowed(let m): return m
    case .unknown(let m):             return m
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
    case .notConnected:      return "NOT_CONNECTED"
    case .connectionLost:    return "CONNECTION_LOST"
    case .invalidURI:        return "INVALID_URI"
    case .operationNotAllowed: return "OPERATION_NOT_ALLOWED"
    case .unknown:           return "UNKNOWN"
    }
  }

  var message: String {
    switch self {
    case .notConnected(let m):      return m
    case .connectionLost(let m):    return m
    case .invalidURI(let m):        return m
    case .operationNotAllowed(let m): return m
    case .unknown(let m):           return m
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

// MARK: — Coordinator

/// Manages the `SPTAppRemote` singleton, the IPC connection lifecycle, and all
/// player transport operations for the running Spotify app.
///
/// - The `SPTAppRemote` instance is created fresh on each `connect()` call so
///   the access token (which may change across sessions) is always current.
/// - `connectionStateString` is `nonisolated(unsafe)` so the module can query
///   it synchronously from the Expo bridge without an async hop. Writes only
///   happen from within the actor's isolation, so the value is safe to read for
///   display purposes (occasional stale reads are acceptable).
/// - Player state subscription is established automatically on connection and
///   torn down on disconnection; events are forwarded to `onPlayerStateChange`.
actor SpotifyAppRemoteCoordinator {
  static let shared: SpotifyAppRemoteCoordinator? = SpotifyAppRemoteCoordinator.create()

  private let sptConfiguration: SPTConfiguration
  private let connectionBridge: SpotifyAppRemoteDelegateBridge
  private let playerStateBridge: SpotifyPlayerStateDelegateBridge
  private let userCapabilitiesBridge: SpotifyUserCapabilitiesDelegateBridge
  private var appRemote: SPTAppRemote?
  private var connectContinuation: CheckedContinuation<Void, Error>?

  nonisolated(unsafe) private(set) var connectionStateString: String = "disconnected"

  var onConnectionStateChange: ((String) -> Void)?
  var onConnectionError: ((String, String) -> Void)?
  var onPlayerStateChange: (([String: Any]) -> Void)?
  var onCapabilitiesChange: (([String: Any]) -> Void)?

  private init(sptConfiguration: SPTConfiguration) {
    self.sptConfiguration = sptConfiguration
    self.connectionBridge = SpotifyAppRemoteDelegateBridge()
    self.playerStateBridge = SpotifyPlayerStateDelegateBridge()
    self.userCapabilitiesBridge = SpotifyUserCapabilitiesDelegateBridge()
    connectionBridge.coordinator = self
    playerStateBridge.coordinator = self
    userCapabilitiesBridge.coordinator = self
  }

  private static func create() -> SpotifyAppRemoteCoordinator? {
    guard
      let configuration = ExpoSpotifyConfiguration.fromInfoPlist(),
      let sptConfig = configuration.sptConfiguration
    else {
      NSLog("[ExpoSpotifySDK] AppRemote: missing or invalid `ExpoSpotifySDK` Info.plist entry")
      return nil
    }
    return SpotifyAppRemoteCoordinator(sptConfiguration: sptConfig)
  }

  // MARK: — Connection lifecycle

  func connect(accessToken: String) async throws {
    if appRemote?.isConnected == true { return }
    guard connectContinuation == nil else {
      throw AppRemoteError.connectionFailed("A connection attempt is already in progress")
    }

    transitionState("connecting")

    let params = SPTAppRemoteConnectionParams(
      accessToken: accessToken,
      defaultImageSize: CGSize.zero,
      imageFormat: .any
    )
    let remote = SPTAppRemote(
      configuration: sptConfiguration,
      connectionParameters: params,
      logLevel: .error
    )
    remote.delegate = connectionBridge
    appRemote = remote

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      self.connectContinuation = cont
      Task { @MainActor in remote.connect() }
    }
  }

  func disconnect() {
    if let cont = connectContinuation {
      connectContinuation = nil
      cont.resume(throwing: AppRemoteError.connectionFailed("Disconnected before connection completed"))
    }
    teardownPlayerSubscription()
    teardownCapabilitiesSubscription()
    appRemote?.disconnect()
    appRemote = nil
    transitionState("disconnected")
  }

  nonisolated func isConnected() -> Bool {
    connectionStateString == "connected"
  }

  func getConnectionState() -> String {
    connectionStateString
  }

  // MARK: — Connection delegate callbacks

  func didConnect() {
    transitionState("connected")
    setupPlayerSubscription()
    setupCapabilitiesSubscription()
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume()
  }

  func didFailToConnect(error: Error?) {
    appRemote = nil
    let msg = error.map { describeNSError($0 as NSError) } ?? "Unknown connection failure"
    let remoteError = AppRemoteError.connectionFailed(msg)
    transitionState("disconnected")
    onConnectionError?(remoteError.code, remoteError.message)
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume(throwing: remoteError)
  }

  func didDisconnect(error: Error?) {
    appRemote = nil
    transitionState("disconnected")
    if let error = error {
      let msg = describeNSError(error as NSError)
      onConnectionError?(AppRemoteError.connectionLost(msg).code, msg)
    }
  }

  // MARK: — Player subscription

  private func setupPlayerSubscription() {
    guard let playerAPI = appRemote?.playerAPI else { return }
    playerAPI.delegate = playerStateBridge
    playerAPI.subscribeToPlayerState { _, _ in }
  }

  private func teardownPlayerSubscription() {
    guard let playerAPI = appRemote?.playerAPI else { return }
    playerAPI.delegate = nil
    playerAPI.unsubscribeToPlayerState { _, _ in }
  }

  /// Called by `SpotifyPlayerStateDelegateBridge` when a state update arrives.
  func playerStateDidChange(_ state: any SPTAppRemotePlayerState) {
    onPlayerStateChange?(Self.playerStateToMap(state))
  }

  // MARK: — User subscription

  private func setupCapabilitiesSubscription() {
    guard let userAPI = appRemote?.userAPI else { return }
    userAPI.delegate = userCapabilitiesBridge
    userAPI.subscribeToCapabilityChanges { _, _ in }
  }

  private func teardownCapabilitiesSubscription() {
    guard let userAPI = appRemote?.userAPI else { return }
    userAPI.delegate = nil
    userAPI.unsubscribeToCapabilityChanges { _, _ in }
  }

  /// Called by `SpotifyUserCapabilitiesDelegateBridge` on each capabilities update.
  func userCapabilitiesDidChange(_ capabilities: any SPTAppRemoteUserCapabilities) {
    onCapabilitiesChange?(Self.capabilitiesToMap(capabilities))
  }

  // MARK: — Player transport

  func playerPlay(uri: String) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.play")
    try await voidPlayerCall(callsite: "Player.play") { playerAPI.play(uri, callback: $0) }
  }

  func playerPause() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.pause")
    try await voidPlayerCall(callsite: "Player.pause") { playerAPI.pause(callback: $0) }
  }

  func playerResume() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.resume")
    try await voidPlayerCall(callsite: "Player.resume") { playerAPI.resume(callback: $0) }
  }

  func playerSkipNext() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.skipNext")
    try await voidPlayerCall(callsite: "Player.skipNext") { playerAPI.skipToNext(callback: $0) }
  }

  func playerSkipPrevious() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.skipPrevious")
    try await voidPlayerCall(callsite: "Player.skipPrevious") { playerAPI.skipToPrevious(callback: $0) }
  }

  func playerSeekTo(positionMs: Int) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.seekTo")
    try await voidPlayerCall(callsite: "Player.seekTo") { playerAPI.seek(toPosition: positionMs, callback: $0) }
  }

  func playerSetShuffle(enabled: Bool) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.setShuffle")
    try await voidPlayerCall(callsite: "Player.setShuffle") { playerAPI.setShuffle(enabled, callback: $0) }
  }

  func playerSetRepeatMode(mode: Int) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.setRepeatMode")
    guard let repeatMode = SPTAppRemotePlaybackOptionsRepeatMode(rawValue: UInt(mode)) else {
      throw NativePlayerError.invalidParameter("Player.setRepeatMode: invalid mode \(mode) — must be 0 (off), 1 (track), or 2 (context)")
    }
    try await voidPlayerCall(callsite: "Player.setRepeatMode") { playerAPI.setRepeatMode(repeatMode, callback: $0) }
  }

  func playerQueue(uri: String) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.queue")
    try await voidPlayerCall(callsite: "Player.queue") { playerAPI.enqueueTrackUri(uri, callback: $0) }
  }

  func playerGetPlayerState() async throws -> [String: Any] {
    let playerAPI = try requirePlayerAPI(callsite: "Player.getPlayerState")
    return try await withCheckedThrowingContinuation { cont in
      playerAPI.getPlayerState { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizePlayerError(error as NSError, callsite: "Player.getPlayerState"))
        } else if let state = result as? any SPTAppRemotePlayerState {
          cont.resume(returning: Self.playerStateToMap(state))
        } else {
          cont.resume(throwing: NativePlayerError.unknown("Player.getPlayerState: unexpected result type"))
        }
      }
    }
  }

  func playerGetCrossfadeState() async throws -> [String: Any] {
    let playerAPI = try requirePlayerAPI(callsite: "Player.getCrossfadeState")
    return try await withCheckedThrowingContinuation { cont in
      playerAPI.getCrossfadeState { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizePlayerError(error as NSError, callsite: "Player.getCrossfadeState"))
        } else if let state = result as? any SPTAppRemoteCrossfadeState {
          cont.resume(returning: ["isEnabled": state.isEnabled, "duration": state.duration])
        } else {
          cont.resume(throwing: NativePlayerError.unknown("Player.getCrossfadeState: unexpected result type"))
        }
      }
    }
  }

  func playerSetPodcastPlaybackSpeed(value: Float) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.setPodcastPlaybackSpeed")
    // Fetch SDK-vended speed objects to find the one matching `value`.
    let speeds: [any SPTAppRemotePodcastPlaybackSpeed] = try await withCheckedThrowingContinuation { cont in
      playerAPI.getAvailablePodcastPlaybackSpeeds { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizePlayerError(error as NSError, callsite: "Player.setPodcastPlaybackSpeed"))
        } else if let speeds = result as? [any SPTAppRemotePodcastPlaybackSpeed] {
          cont.resume(returning: speeds)
        } else {
          cont.resume(throwing: NativePlayerError.unknown("Player.setPodcastPlaybackSpeed: unexpected result from getAvailablePodcastPlaybackSpeeds"))
        }
      }
    }
    guard let speed = speeds.first(where: { abs($0.value.floatValue - value) < 0.01 }) else {
      let available = speeds.map { $0.value.floatValue }
      throw NativePlayerError.invalidParameter(
        "Player.setPodcastPlaybackSpeed: unsupported speed \(value). Available: \(available)"
      )
    }
    try await voidPlayerCall(callsite: "Player.setPodcastPlaybackSpeed") {
      playerAPI.setPodcastPlaybackSpeed(speed, callback: $0)
    }
  }

  // MARK: — User operations

  func userGetCapabilities() async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.getCapabilities")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.fetchCapabilities { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeUserError(error as NSError, callsite: "User.getCapabilities"))
        } else if let capabilities = result as? any SPTAppRemoteUserCapabilities {
          cont.resume(returning: Self.capabilitiesToMap(capabilities))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.getCapabilities: unexpected result type"))
        }
      }
    }
  }

  func userGetLibraryState(uri: String) async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.getLibraryState")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.fetchLibraryState(forURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeUserError(error as NSError, callsite: "User.getLibraryState"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: Self.libraryStateToMap(state))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.getLibraryState: unexpected result type"))
        }
      }
    }
  }

  func userAddToLibrary(uri: String) async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.addToLibrary")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.addItem(toLibraryWithURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeUserError(error as NSError, callsite: "User.addToLibrary"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: Self.libraryStateToMap(state))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.addToLibrary: unexpected result type"))
        }
      }
    }
  }

  func userRemoveFromLibrary(uri: String) async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.removeFromLibrary")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.removeItem(fromLibraryWithURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeUserError(error as NSError, callsite: "User.removeFromLibrary"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: Self.libraryStateToMap(state))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.removeFromLibrary: unexpected result type"))
        }
      }
    }
  }

  // MARK: — Content operations

  func contentGetRecommendedContentItems(type: String) async throws -> [[String: Any]] {
    let contentAPI = try requireContentAPI(callsite: "Content.getRecommendedContentItems")
    return try await withCheckedThrowingContinuation { cont in
      contentAPI.fetchRecommendedContentItems(forType: Self.mapContentType(type), flattenContainers: false) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeContentError(error as NSError, callsite: "Content.getRecommendedContentItems"))
        } else if let list = result as? [any SPTAppRemoteContentItem] {
          cont.resume(returning: list.map(Self.contentItemToMap))
        } else {
          cont.resume(throwing: NativeContentError.unknown("Content.getRecommendedContentItems: unexpected result type"))
        }
      }
    }
  }

  func contentGetChildren(itemMap: [String: Any]) async throws -> [[String: Any]] {
    let contentAPI = try requireContentAPI(callsite: "Content.getChildren")
    guard let uri = itemMap["uri"] as? String, !uri.isEmpty else {
      throw NativeContentError.unknown("Content.getChildren: missing item uri")
    }

    let contentItem: any SPTAppRemoteContentItem = try await withCheckedThrowingContinuation { cont in
      contentAPI.fetchContentItem(forURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeContentError(error as NSError, callsite: "Content.getChildren"))
        } else if let item = result as? any SPTAppRemoteContentItem {
          cont.resume(returning: item)
        } else {
          cont.resume(throwing: NativeContentError.unknown("Content.getChildren: failed to resolve content item from URI"))
        }
      }
    }

    return try await withCheckedThrowingContinuation { cont in
      contentAPI.fetchChildren(ofContentItem: contentItem) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeContentError(error as NSError, callsite: "Content.getChildren"))
        } else if let children = result as? [any SPTAppRemoteContentItem] {
          cont.resume(returning: children.map(Self.contentItemToMap))
        } else {
          cont.resume(throwing: NativeContentError.unknown("Content.getChildren: unexpected result type"))
        }
      }
    }
  }

  // MARK: — Images operations

  func imagesLoad(imageIdentifier: String, size: String) async throws -> [String: Any] {
    guard !imageIdentifier.isEmpty else {
      throw NativeImagesError.invalidURI("Images.load: imageIdentifier must be non-empty")
    }
    let imageAPI = try requireImageAPI(callsite: "Images.load")
    let representable = LocalImageRepresentable(imageIdentifier: imageIdentifier)
    let targetSize = Self.mapImageSize(size)

    let image: UIImage = try await withCheckedThrowingContinuation { cont in
      imageAPI.fetchImage(forItem: representable, with: targetSize) { result, error in
        if let error = error {
          cont.resume(throwing: Self.normalizeImagesError(error as NSError, callsite: "Images.load"))
        } else if let image = result as? UIImage {
          cont.resume(returning: image)
        } else {
          cont.resume(throwing: NativeImagesError.imageLoadFailed("Images.load: unexpected image result type"))
        }
      }
    }

    let data = image.pngData() ?? image.jpegData(compressionQuality: 1.0)
    guard let bytes = data else {
      throw NativeImagesError.imageLoadFailed("Images.load: failed to encode image data")
    }
    let filename = "expo-spotify-image-\(UUID().uuidString).png"
    let path = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(filename)
    do {
      try bytes.write(to: path, options: .atomic)
      return ["uri": path.absoluteString]
    } catch {
      throw NativeImagesError.imageLoadFailed("Images.load: failed to write temp image file")
    }
  }

  // MARK: — Internal helpers

  private func requirePlayerAPI(callsite: String) throws -> any SPTAppRemotePlayerAPI {
    guard let remote = appRemote, remote.isConnected, let playerAPI = remote.playerAPI else {
      throw NativePlayerError.notConnected(
        "\(callsite): requires an active App Remote connection — call AppRemote.connect() first"
      )
    }
    return playerAPI
  }

  private func requireUserAPI(callsite: String) throws -> any SPTAppRemoteUserAPI {
    guard let remote = appRemote, remote.isConnected, let userAPI = remote.userAPI else {
      throw NativeUserError.notConnected(
        "\(callsite): requires an active App Remote connection — call AppRemote.connect() first"
      )
    }
    return userAPI
  }

  private func requireContentAPI(callsite: String) throws -> any SPTAppRemoteContentAPI {
    guard let remote = appRemote, remote.isConnected, let contentAPI = remote.contentAPI else {
      throw NativeContentError.notConnected(
        "\(callsite): requires an active App Remote connection — call AppRemote.connect() first"
      )
    }
    return contentAPI
  }

  private func requireImageAPI(callsite: String) throws -> any SPTAppRemoteImageAPI {
    guard let remote = appRemote, remote.isConnected, let imageAPI = remote.imageAPI else {
      throw NativeImagesError.notConnected(
        "\(callsite): requires an active App Remote connection — call AppRemote.connect() first"
      )
    }
    return imageAPI
  }

  private func voidPlayerCall(
    callsite: String,
    block: (@escaping SPTAppRemoteCallback) -> Void
  ) async throws {
    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      block { _, error in
        if let error = error {
          cont.resume(throwing: Self.normalizePlayerError(error as NSError, callsite: callsite))
        } else {
          cont.resume()
        }
      }
    }
  }

  private static func normalizePlayerError(_ error: NSError, callsite: String) -> NativePlayerError {
    guard error.domain == SPTAppRemoteErrorDomain else {
      return .unknown(error.localizedDescription)
    }
    switch error.code {
    case SPTAppRemoteConnectionTerminatedError:
      return .connectionLost("\(callsite): connection to Spotify app was terminated")
    case SPTAppRemoteInvalidArgumentsError:
      return .invalidParameter(error.localizedDescription)
    case SPTAppRemoteRequestFailedError:
      let desc = error.localizedDescription.lowercased()
      if desc.contains("premium") {
        return .premiumRequired("\(callsite): Spotify Premium is required for on-demand playback")
      }
      if desc.contains("not allowed") || desc.contains("restriction") {
        return .operationNotAllowed("\(callsite): \(error.localizedDescription)")
      }
      return .unknown(error.localizedDescription)
    default:
      return .unknown(error.localizedDescription)
    }
  }

  private static func playerStateToMap(_ state: any SPTAppRemotePlayerState) -> [String: Any] {
    let track = state.track
    let restrictions = state.playbackRestrictions
    let options = state.playbackOptions
    return [
      "track": [
        "uri": track.URI,
        "name": track.name,
        "imageIdentifier": track.imageIdentifier,
        "duration": track.duration,
        "artist": ["name": track.artist.name, "uri": track.artist.URI],
        "album": ["name": track.album.name, "uri": track.album.URI],
        "isSaved": track.isSaved,
        "isEpisode": track.isEpisode,
        "isPodcast": track.isPodcast,
        "isAdvertisement": track.isAdvertisement,
      ] as [String: Any],
      "playbackPosition": state.playbackPosition,
      "playbackSpeed": state.playbackSpeed,
      "isPaused": state.isPaused,
      "playbackOptions": [
        "isShuffling": options.isShuffling,
        "repeatMode": options.repeatMode.rawValue,
      ] as [String: Any],
      "playbackRestrictions": [
        "canSkipNext": restrictions.canSkipNext,
        "canSkipPrevious": restrictions.canSkipPrevious,
        "canRepeatTrack": restrictions.canRepeatTrack,
        "canRepeatContext": restrictions.canRepeatContext,
        "canToggleShuffle": restrictions.canToggleShuffle,
        "canSeek": restrictions.canSeek,
      ] as [String: Any],
      "contextTitle": state.contextTitle,
      "contextUri": state.contextURI.absoluteString,
    ]
  }

  private static func capabilitiesToMap(_ capabilities: any SPTAppRemoteUserCapabilities) -> [String: Any] {
    ["canPlayOnDemand": capabilities.canPlayOnDemand]
  }

  private static func libraryStateToMap(_ state: any SPTAppRemoteLibraryState) -> [String: Any] {
    ["uri": state.uri, "isAdded": state.isAdded, "canAdd": state.canAdd]
  }

  private static func normalizeUserError(_ error: NSError, callsite: String) -> NativeUserError {
    guard error.domain == SPTAppRemoteErrorDomain else {
      return .unknown(error.localizedDescription)
    }
    switch error.code {
    case SPTAppRemoteConnectionTerminatedError:
      return .connectionLost("\(callsite): connection to Spotify app was terminated")
    case SPTAppRemoteInvalidArgumentsError:
      return .invalidURI("\(callsite): \(error.localizedDescription)")
    case SPTAppRemoteRequestFailedError:
      let desc = error.localizedDescription.lowercased()
      if desc.contains("not allowed") || desc.contains("restriction") {
        return .operationNotAllowed("\(callsite): \(error.localizedDescription)")
      }
      return .unknown(error.localizedDescription)
    default:
      return .unknown(error.localizedDescription)
    }
  }

  private static func normalizeContentError(_ error: NSError, callsite: String) -> NativeContentError {
    guard error.domain == SPTAppRemoteErrorDomain else {
      return .unknown(error.localizedDescription)
    }
    switch error.code {
    case SPTAppRemoteConnectionTerminatedError:
      return .connectionLost("\(callsite): connection to Spotify app was terminated")
    case SPTAppRemoteRequestFailedError:
      let desc = error.localizedDescription.lowercased()
      if desc.contains("not supported") || desc.contains("unsupported") {
        return .contentAPIUnavailable("\(callsite): content API is unavailable on this Spotify app version")
      }
      return .unknown(error.localizedDescription)
    default:
      return .unknown(error.localizedDescription)
    }
  }

  private static func normalizeImagesError(_ error: NSError, callsite: String) -> NativeImagesError {
    guard error.domain == SPTAppRemoteErrorDomain else {
      return .unknown(error.localizedDescription)
    }
    switch error.code {
    case SPTAppRemoteConnectionTerminatedError:
      return .notConnected("\(callsite): connection to Spotify app was terminated")
    case SPTAppRemoteInvalidArgumentsError:
      return .invalidURI("\(callsite): invalid image identifier")
    case SPTAppRemoteRequestFailedError:
      return .imageLoadFailed("\(callsite): Spotify rejected image request")
    default:
      return .unknown(error.localizedDescription)
    }
  }

  private static func mapContentType(_ type: String) -> SPTAppRemoteContentType {
    switch type {
    case "navigation": return SPTAppRemoteContentTypeNavigation
    case "fitness": return SPTAppRemoteContentTypeFitness
    case "gaming": return SPTAppRemoteContentTypeGaming
    default: return SPTAppRemoteContentTypeDefault
    }
  }

  private static func mapImageSize(_ size: String) -> CGSize {
    switch size {
    case "small": return CGSize(width: 64, height: 64)
    case "medium": return CGSize(width: 300, height: 300)
    default: return CGSize(width: 640, height: 640)
    }
  }

  private static func contentItemToMap(_ item: any SPTAppRemoteContentItem) -> [String: Any] {
    var map: [String: Any] = [
      "title": item.title as Any,
      "subtitle": item.subtitle as Any,
      "contentDescription": item.contentDescription as Any,
      "identifier": item.identifier,
      "uri": item.URI,
      "imageIdentifier": item.imageIdentifier,
      "isAvailableOffline": item.isAvailableOffline,
      "isPlayable": item.isPlayable,
      "isContainer": item.isContainer,
      "isPinned": item.isPinned,
    ]
    if let children = item.children {
      map["children"] = children.map(Self.contentItemToMap)
    }
    return map
  }

  private func transitionState(_ state: String) {
    connectionStateString = state
    onConnectionStateChange?(state)
  }

  private func describeNSError(_ error: NSError) -> String {
    var parts: [String] = ["\(error.domain) code \(error.code)"]
    let desc = error.localizedDescription
    if !desc.isEmpty { parts.append("\"\(desc)\"") }
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
      parts.append("→ \(describeNSError(underlying))")
    }
    return parts.joined(separator: " ")
  }
}

// MARK: — Connection delegate bridge

/// `SPTAppRemoteDelegate` requires `NSObject` conformance, which an `actor`
/// cannot satisfy directly. This bridge is a tiny `NSObject` that hops each
/// delegate callback onto the actor's executor via a `Task`.
final class SpotifyAppRemoteDelegateBridge: NSObject, SPTAppRemoteDelegate {
  weak var coordinator: SpotifyAppRemoteCoordinator?

  func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
    NSLog("[ExpoSpotifySDK] AppRemote: connection established")
    Task { await coordinator?.didConnect() }
  }

  func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: (any Error)?) {
    NSLog("[ExpoSpotifySDK] AppRemote: connection failed — %@", String(describing: error))
    Task { await coordinator?.didFailToConnect(error: error) }
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: (any Error)?) {
    NSLog("[ExpoSpotifySDK] AppRemote: disconnected — %@", String(describing: error))
    Task { await coordinator?.didDisconnect(error: error) }
  }
}

// MARK: — Player state delegate bridge

/// `SPTAppRemotePlayerStateDelegate` requires `NSObject` conformance. This
/// bridge forwards player state updates to the actor coordinator.
final class SpotifyPlayerStateDelegateBridge: NSObject, SPTAppRemotePlayerStateDelegate {
  weak var coordinator: SpotifyAppRemoteCoordinator?

  func playerStateDidChange(_ playerState: any SPTAppRemotePlayerState) {
    Task { await coordinator?.playerStateDidChange(playerState) }
  }
}

// MARK: — User capabilities delegate bridge

final class SpotifyUserCapabilitiesDelegateBridge: NSObject, SPTAppRemoteUserAPIDelegate {
  weak var coordinator: SpotifyAppRemoteCoordinator?

  func userAPI(_ userAPI: any SPTAppRemoteUserAPI, didReceiveCapabilities capabilities: any SPTAppRemoteUserCapabilities) {
    Task { await coordinator?.userCapabilitiesDidChange(capabilities) }
  }
}

// MARK: — Local image wrapper

final class LocalImageRepresentable: NSObject, SPTAppRemoteImageRepresentable {
  let imageIdentifier: String

  init(imageIdentifier: String) {
    self.imageIdentifier = imageIdentifier
    super.init()
  }
}
