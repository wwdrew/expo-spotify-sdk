import Foundation
import SpotifyiOS
import UIKit

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

  let sptConfiguration: SPTConfiguration
  let connectionBridge: SpotifyAppRemoteDelegateBridge
  private let playerStateBridge: SpotifyPlayerStateDelegateBridge
  private let userCapabilitiesBridge: SpotifyUserCapabilitiesDelegateBridge
  var appRemote: SPTAppRemote?
  var connectContinuation: CheckedContinuation<Void, Error>?

  /// In-flight connection attempt, readable from the synchronous redirect path.
  /// `nil` whenever no connection attempt is active.
  nonisolated(unsafe) var connectionAttempt: AppRemoteConnectionAttempt?

  nonisolated(unsafe) private(set) var connectionStateString: String = "disconnected"

  var onConnectionStateChange: ((String) -> Void)?
  var onConnectionError: ((String, String) -> Void)?
  var onPlayerStateChange: (([String: Any]) -> Void)?
  var onCapabilitiesChange: (([String: Any]) -> Void)?

  func setEventHandlers(
    onConnectionStateChange: @escaping (String) -> Void,
    onConnectionError: @escaping (String, String) -> Void,
    onPlayerStateChange: @escaping ([String: Any]) -> Void,
    onCapabilitiesChange: @escaping ([String: Any]) -> Void
  ) {
    self.onConnectionStateChange = onConnectionStateChange
    self.onConnectionError = onConnectionError
    self.onPlayerStateChange = onPlayerStateChange
    self.onCapabilitiesChange = onCapabilitiesChange
  }

  private init(sptConfiguration: SPTConfiguration) {
    self.sptConfiguration = sptConfiguration
    let connectionBridge = SpotifyAppRemoteDelegateBridge()
    let playerStateBridge = SpotifyPlayerStateDelegateBridge()
    let userCapabilitiesBridge = SpotifyUserCapabilitiesDelegateBridge()
    self.connectionBridge = connectionBridge
    self.playerStateBridge = playerStateBridge
    self.userCapabilitiesBridge = userCapabilitiesBridge
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

  // MARK: — Player subscription

  func setupPlayerSubscription() {
    guard let playerAPI = appRemote?.playerAPI else { return }
    playerAPI.delegate = playerStateBridge
    playerAPI.subscribe(toPlayerState: { _, _ in })
  }

  func teardownPlayerSubscription() {
    guard let playerAPI = appRemote?.playerAPI else { return }
    playerAPI.delegate = nil
    playerAPI.unsubscribe(toPlayerState: { _, _ in })
  }

  /// Called by `SpotifyPlayerStateDelegateBridge` when a state update arrives.
  func playerStateDidChange(_ state: any SPTAppRemotePlayerState) {
    onPlayerStateChange?(SpotifyAppRemoteMappers.playerStateToMap(state))
  }

  // MARK: — User subscription

  func setupCapabilitiesSubscription() {
    guard let userAPI = appRemote?.userAPI else { return }
    userAPI.delegate = userCapabilitiesBridge
    userAPI.subscribe(toCapabilityChanges: { _, _ in })
  }

  func teardownCapabilitiesSubscription() {
    guard let userAPI = appRemote?.userAPI else { return }
    userAPI.delegate = nil
    userAPI.unsubscribe(toCapabilityChanges: { _, _ in })
  }

  /// Called by `SpotifyUserCapabilitiesDelegateBridge` on each capabilities update.
  func userCapabilitiesDidChange(_ capabilities: any SPTAppRemoteUserCapabilities) {
    onCapabilitiesChange?(SpotifyAppRemoteMappers.capabilitiesToMap(capabilities))
  }

  // MARK: — Player transport

  func playerPlay(uri: String) async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.play")
    try await voidPlayerCall(callsite: "Player.play") { playerAPI.play(uri, callback: $0) }
  }

  func playerPause() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.pause")
    try await voidPlayerCall(callsite: "Player.pause") { playerAPI.pause($0) }
  }

  func playerResume() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.resume")
    try await voidPlayerCall(callsite: "Player.resume") { playerAPI.resume($0) }
  }

  func playerSkipNext() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.skipNext")
    try await voidPlayerCall(callsite: "Player.skipNext") { playerAPI.skip(toNext: $0) }
  }

  func playerSkipPrevious() async throws {
    let playerAPI = try requirePlayerAPI(callsite: "Player.skipPrevious")
    try await voidPlayerCall(callsite: "Player.skipPrevious") { playerAPI.skip(toPrevious: $0) }
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapPlayerError(error as NSError, callsite: "Player.getPlayerState"))
        } else if let state = result as? any SPTAppRemotePlayerState {
          cont.resume(returning: SpotifyAppRemoteMappers.playerStateToMap(state))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapPlayerError(error as NSError, callsite: "Player.getCrossfadeState"))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapPlayerError(error as NSError, callsite: "Player.setPodcastPlaybackSpeed"))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapUserError(error as NSError, callsite: "User.getCapabilities"))
        } else if let capabilities = result as? any SPTAppRemoteUserCapabilities {
          cont.resume(returning: SpotifyAppRemoteMappers.capabilitiesToMap(capabilities))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapUserError(error as NSError, callsite: "User.getLibraryState"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: SpotifyAppRemoteMappers.libraryStateToMap(state))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.getLibraryState: unexpected result type"))
        }
      }
    }
  }

  func userAddToLibrary(uri: String) async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.addToLibrary")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.addItemToLibrary(withURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapUserError(error as NSError, callsite: "User.addToLibrary"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: SpotifyAppRemoteMappers.libraryStateToMap(state))
        } else {
          cont.resume(throwing: NativeUserError.unknown("User.addToLibrary: unexpected result type"))
        }
      }
    }
  }

  func userRemoveFromLibrary(uri: String) async throws -> [String: Any] {
    let userAPI = try requireUserAPI(callsite: "User.removeFromLibrary")
    return try await withCheckedThrowingContinuation { cont in
      userAPI.removeItemFromLibrary(withURI: uri) { result, error in
        if let error = error {
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapUserError(error as NSError, callsite: "User.removeFromLibrary"))
        } else if let state = result as? any SPTAppRemoteLibraryState {
          cont.resume(returning: SpotifyAppRemoteMappers.libraryStateToMap(state))
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
      contentAPI.fetchRecommendedContentItems(forType: SpotifyAppRemoteMappers.mapContentType(type), flattenContainers: false) { result, error in
        if let error = error {
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapContentError(error as NSError, callsite: "Content.getRecommendedContentItems"))
        } else if let list = result as? [any SPTAppRemoteContentItem] {
          cont.resume(returning: list.map(SpotifyAppRemoteMappers.contentItemToMap))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapContentError(error as NSError, callsite: "Content.getChildren"))
        } else if let item = result as? any SPTAppRemoteContentItem {
          cont.resume(returning: item)
        } else {
          cont.resume(throwing: NativeContentError.unknown("Content.getChildren: failed to resolve content item from URI"))
        }
      }
    }

    return try await withCheckedThrowingContinuation { cont in
      contentAPI.fetchChildren(of: contentItem, callback: { result, error in
        if let error = error {
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapContentError(error as NSError, callsite: "Content.getChildren"))
        } else if let children = result as? [any SPTAppRemoteContentItem] {
          cont.resume(returning: children.map(SpotifyAppRemoteMappers.contentItemToMap))
        } else {
          cont.resume(throwing: NativeContentError.unknown("Content.getChildren: unexpected result type"))
        }
      })
    }
  }

  // MARK: — Images operations

  func imagesLoad(imageIdentifier: String, size: String) async throws -> [String: Any] {
    guard !imageIdentifier.isEmpty else {
      throw NativeImagesError.invalidURI("Images.load: imageIdentifier must be non-empty")
    }
    let imageAPI = try requireImageAPI(callsite: "Images.load")
    let representable = LocalImageRepresentable(imageIdentifier: imageIdentifier)
    let targetSize = SpotifyAppRemoteMappers.mapImageSize(size)

    let image: UIImage = try await withCheckedThrowingContinuation { cont in
      imageAPI.fetchImage(forItem: representable, with: targetSize) { result, error in
        if let error = error {
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapImagesError(error as NSError, callsite: "Images.load"))
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
          cont.resume(throwing: SpotifyAppRemoteErrorMapping.mapPlayerError(error as NSError, callsite: callsite))
        } else {
          cont.resume()
        }
      }
    }
  }

  func transitionState(_ state: String) {
    connectionStateString = state
    onConnectionStateChange?(state)
  }

  func describeNSError(_ error: NSError) -> String {
    var parts: [String] = ["\(error.domain) code \(error.code)"]
    let desc = error.localizedDescription
    if !desc.isEmpty { parts.append("\"\(desc)\"") }
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
      parts.append("→ \(describeNSError(underlying))")
    }
    return parts.joined(separator: " ")
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

  func userAPI(_ userAPI: any SPTAppRemoteUserAPI, didReceive capabilities: any SPTAppRemoteUserCapabilities) {
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
