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

  private let sptConfiguration: SPTConfiguration
  private let connectionBridge: SpotifyAppRemoteDelegateBridge
  private let playerStateBridge: SpotifyPlayerStateDelegateBridge
  private let userCapabilitiesBridge: SpotifyUserCapabilitiesDelegateBridge
  private var appRemote: SPTAppRemote?
  private var connectContinuation: CheckedContinuation<Void, Error>?

  /// The `SPTAppRemote` awaiting an `authorizeAndPlay()` redirect, exposed
  /// synchronously to the URL-redirect path. Mirrors the auth coordinator's
  /// `nonisolated(unsafe)` `sessionManager`: it is only written from the
  /// actor's executor (or the main-thread redirect handler) and read on the
  /// main thread, so occasional cross-actor access is acceptable. `nil`
  /// whenever no authorize-and-play flow is in flight.
  nonisolated(unsafe) private var pendingAuthorizeRemote: SPTAppRemote?

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

  /// Wakes the Spotify app (via `authorizeAndPlayURI`), starts playback, and
  /// then completes the App Remote connection once Spotify redirects back.
  ///
  /// Unlike `connect()`, this works even when the Spotify app has been
  /// suspended: `authorizeAndPlayURI` performs an app-switch to Spotify, which
  /// revives it. Spotify then redirects back to the host app with an access
  /// token; `handleAuthorizeRedirect(_:)` consumes that redirect and calls
  /// `connect()` on the same `SPTAppRemote` instance.
  ///
  /// The `connectContinuation` is reused for the whole flow, so `didConnect()`
  /// / `didFailToConnect(error:)` resolve it exactly as for `connect()`.
  func authorizeAndPlay(uri: String, accessToken: String) async throws {
    if appRemote?.isConnected == true {
      // Already connected — honour the request by (re)starting playback.
      if uri.isEmpty {
        try await playerResume()
      } else {
        try await playerPlay(uri: uri)
      }
      return
    }
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
    pendingAuthorizeRemote = remote

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      self.connectContinuation = cont
      Task { @MainActor in
        // `authorizeAndPlayURI` app-switches to Spotify to wake it. `success`
        // is false when the Spotify app could not be opened (e.g. not
        // installed) — no redirect will arrive, so fail the continuation now.
        // On success we await the redirect, handled by
        // `handleAuthorizeRedirect(_:)`, which completes the connection.
        let success = await remote.authorizeAndPlayURI(uri)
        if !success {
          await self.didFailToConnect(error: NSError(
            domain: "ExpoSpotifySDK",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "authorizeAndPlay: could not open the Spotify app (is it installed?)"]
          ))
        }
      }
    }
  }

  /// Consumes a redirect URL produced by an `authorizeAndPlay()` app-switch.
  /// Returns `true` if an authorize flow was pending and the URL was handled
  /// (so the AppDelegate should not also forward it to the auth coordinator).
  ///
  /// Synchronous + `nonisolated` because the AppDelegate `open url` hook
  /// expects an immediate `Bool`, matching `SpotifyAuthCoordinator.handleOpenURL`.
  nonisolated func handleAuthorizeRedirect(_ url: URL) -> Bool {
    guard let remote = pendingAuthorizeRemote else { return false }
    let consume: () -> Bool = { [self] in
      MainActor.assumeIsolated {
        let params = remote.authorizationParameters(from: url)
        if let token = params?[SPTAppRemoteAccessTokenKey] {
          remote.connectionParameters.accessToken = token
          pendingAuthorizeRemote = nil
          remote.connect()
          return true
        } else if let errorDescription = params?[SPTAppRemoteErrorDescriptionKey] {
          pendingAuthorizeRemote = nil
          Task {
            await self.didFailToConnect(error: NSError(
              domain: "ExpoSpotifySDK",
              code: -2,
              userInfo: [NSLocalizedDescriptionKey: errorDescription]
            ))
          }
          return true
        }
        return false
      }
    }
    if Thread.isMainThread {
      return consume()
    }
    return DispatchQueue.main.sync(execute: consume)
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
    pendingAuthorizeRemote = nil
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
    pendingAuthorizeRemote = nil
    transitionState("connected")
    setupPlayerSubscription()
    setupCapabilitiesSubscription()
    let cont = connectContinuation
    connectContinuation = nil
    cont?.resume()
  }

  func didFailToConnect(error: Error?) {
    appRemote = nil
    pendingAuthorizeRemote = nil
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
    playerAPI.subscribe(toPlayerState: { _, _ in })
  }

  private func teardownPlayerSubscription() {
    guard let playerAPI = appRemote?.playerAPI else { return }
    playerAPI.delegate = nil
    playerAPI.unsubscribe(toPlayerState: { _, _ in })
  }

  /// Called by `SpotifyPlayerStateDelegateBridge` when a state update arrives.
  func playerStateDidChange(_ state: any SPTAppRemotePlayerState) {
    onPlayerStateChange?(SpotifyAppRemoteMappers.playerStateToMap(state))
  }

  // MARK: — User subscription

  private func setupCapabilitiesSubscription() {
    guard let userAPI = appRemote?.userAPI else { return }
    userAPI.delegate = userCapabilitiesBridge
    userAPI.subscribe(toCapabilityChanges: { _, _ in })
  }

  private func teardownCapabilitiesSubscription() {
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
