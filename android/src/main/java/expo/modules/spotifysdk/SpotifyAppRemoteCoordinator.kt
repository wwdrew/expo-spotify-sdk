package expo.modules.spotifysdk

import android.content.Context
import android.graphics.Bitmap
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.ContentApi
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.CallResult
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.Capabilities
import com.spotify.protocol.types.CrossfadeState
import com.spotify.protocol.types.Image
import com.spotify.protocol.types.ImageUri
import com.spotify.protocol.types.LibraryState
import com.spotify.protocol.types.ListItem
import com.spotify.protocol.types.ListItems
import com.spotify.protocol.types.PlayerState
import com.spotify.protocol.types.PlaybackSpeed
import com.spotify.protocol.types.Repeat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs

/**
 * Manages the [SpotifyAppRemote] singleton, the IPC connection lifecycle, and all
 * player transport operations for the running Spotify app.
 *
 * ## Android vs iOS token handling
 *
 * On iOS the access token is passed directly into `SPTAppRemoteConnectionParams`
 * and used by the SDK to authenticate the IPC channel. On Android the Spotify
 * App Remote SDK does not accept a token in [ConnectionParams]; it relies on the
 * token that was cached in the Spotify app during the Auth SDK flow
 * (`showAuthView(false)` suppresses Spotify's own auth UI since the user is
 * already authenticated). The `accessToken` parameter to [connect] is accepted
 * for API parity with iOS but is not forwarded to the Android SDK.
 */
class SpotifyAppRemoteCoordinator {
  @Volatile private var appRemote: SpotifyAppRemote? = null
  @Volatile private var connectionState: String = "disconnected"
  private val connectMutex = Mutex()

  private var playerStateSubscription: Subscription<PlayerState>? = null
  private var capabilitiesSubscription: Subscription<Capabilities>? = null
  @Volatile private var lastTrackUri: String? = null
  @Volatile private var lastNonEmptyTrackName: String? = null

  /** Injected by the module to forward connection state-change events to JS. */
  var onConnectionStateChange: ((String) -> Unit)? = null

  /** Injected by the module to forward connection error events to JS. */
  var onConnectionError: ((String, String) -> Unit)? = null

  /** Injected by the module to forward player state change events to JS. */
  var onPlayerStateChange: ((Map<String, Any?>) -> Unit)? = null

  /** Injected by the module to forward user capabilities events to JS. */
  var onCapabilitiesChange: ((Map<String, Any?>) -> Unit)? = null

  fun isConnected(): Boolean = appRemote?.isConnected == true

  fun getConnectionState(): String = connectionState

  /**
   * Establishes a connection to the Spotify app.
   *
   * Suspends until [Connector.ConnectionListener.onConnected] or
   * [Connector.ConnectionListener.onFailure] fires. Re-entry while a
   * connection is already active is a no-op; re-entry while a connection is
   * in progress throws [AppRemoteConnectionFailedException].
   *
   * @param context  Application or activity context.
   * @param clientId Spotify client ID from the manifest.
   * @param redirectUri Redirect URI registered in the Spotify Dashboard.
   * @param accessToken The access token from [SpotifyAuthCoordinator] (iOS-parity
   *   parameter; not forwarded to the Android SDK — see class kdoc).
   */
  suspend fun connect(
    context: Context,
    clientId: String,
    redirectUri: String,
    @Suppress("UNUSED_PARAMETER") accessToken: String,
  ) {
    if (appRemote?.isConnected == true) return
    if (!connectMutex.tryLock()) {
      throw AppRemoteConnectionFailedException("A connection attempt is already in progress")
    }

    transitionState("connecting")

    try {
      suspendCancellableCoroutine { continuation ->
        val params = ConnectionParams.Builder(clientId)
          .setRedirectUri(redirectUri)
          .showAuthView(false)
          .build()

        SpotifyAppRemote.connect(context, params, object : Connector.ConnectionListener {
          override fun onConnected(remote: SpotifyAppRemote) {
            appRemote = remote
            transitionState("connected")
            subscribeToPlayerState(remote)
            subscribeToCapabilities(remote)
            continuation.resume(Unit)
          }

          override fun onFailure(throwable: Throwable) {
            transitionState("disconnected")
            val code = "CONNECTION_FAILED"
            val message = throwable.message ?: "Unknown connection failure"
            onConnectionError?.invoke(code, message)
            continuation.resumeWithException(
              AppRemoteConnectionFailedException(message, throwable)
            )
          }
        })

        continuation.invokeOnCancellation {
          appRemote?.let { SpotifyAppRemote.disconnect(it) }
          appRemote = null
          transitionState("disconnected")
        }
      }
    } finally {
      connectMutex.unlock()
    }
  }

  /**
   * Wakes the Spotify app and starts playback, then ensures an active App
   * Remote connection — the cross-platform counterpart of iOS
   * `authorizeAndPlayURI`.
   *
   * On Android there is no dedicated "authorize and play" entry point:
   * [SpotifyAppRemote.connect] already launches/wakes the Spotify service when
   * it is installed, so this simply connects (if not already connected) and
   * then issues a play (or resume, for an empty [uri]) command. The resulting
   * playback keeps Spotify alive, mirroring the iOS behaviour.
   *
   * @param uri Spotify URI to play, or empty to resume the last/contextual track.
   */
  suspend fun authorizeAndPlay(
    context: Context,
    clientId: String,
    redirectUri: String,
    accessToken: String,
    uri: String,
  ) {
    if (appRemote?.isConnected != true) {
      connect(context, clientId, redirectUri, accessToken)
    }
    if (uri.isEmpty()) {
      requireConnected("AppRemote.authorizeAndPlay").playerApi.resume()
        .awaitVoid("AppRemote.authorizeAndPlay")
    } else {
      requireConnected("AppRemote.authorizeAndPlay").playerApi.play(uri)
        .awaitVoid("AppRemote.authorizeAndPlay")
    }
  }

  /**
   * Disconnects from the Spotify app. Safe to call when already disconnected.
   */
  fun disconnect() {
    cancelPlayerStateSubscription()
    cancelCapabilitiesSubscription()
    val remote = appRemote ?: return
    appRemote = null
    SpotifyAppRemote.disconnect(remote)
    transitionState("disconnected")
  }

  // MARK: — Player subscription

  private fun subscribeToPlayerState(remote: SpotifyAppRemote) {
    val subscription = remote.playerApi
      .subscribeToPlayerState()
      .setEventCallback { playerState ->
        onPlayerStateChange?.invoke(playerStateToMap(playerState, this))
      }
    subscription.setErrorCallback { /* subscription errors are non-fatal; connection errors handled separately */ }
    playerStateSubscription = subscription
  }

  private fun cancelPlayerStateSubscription() {
    playerStateSubscription?.cancel()
    playerStateSubscription = null
  }

  // MARK: — User capabilities subscription

  private fun subscribeToCapabilities(remote: SpotifyAppRemote) {
    val subscription = remote.userApi
      .subscribeToCapabilities()
      .setEventCallback { capabilities ->
        onCapabilitiesChange?.invoke(capabilitiesToMap(capabilities))
      }
    subscription.setErrorCallback { /* subscription errors are non-fatal */ }
    capabilitiesSubscription = subscription
  }

  private fun cancelCapabilitiesSubscription() {
    capabilitiesSubscription?.cancel()
    capabilitiesSubscription = null
  }

  // MARK: — Player transport

  suspend fun playerPlay(uri: String) {
    requireConnected("Player.play").playerApi.play(uri).awaitVoid("Player.play")
  }

  suspend fun playerPause() {
    requireConnected("Player.pause").playerApi.pause().awaitVoid("Player.pause")
  }

  suspend fun playerResume() {
    requireConnected("Player.resume").playerApi.resume().awaitVoid("Player.resume")
  }

  suspend fun playerSkipNext() {
    requireConnected("Player.skipNext").playerApi.skipNext().awaitVoid("Player.skipNext")
  }

  suspend fun playerSkipPrevious() {
    requireConnected("Player.skipPrevious").playerApi.skipPrevious().awaitVoid("Player.skipPrevious")
  }

  suspend fun playerSeekTo(positionMs: Long) {
    requireConnected("Player.seekTo").playerApi.seekTo(positionMs).awaitVoid("Player.seekTo")
  }

  suspend fun playerSetShuffle(enabled: Boolean) {
    requireConnected("Player.setShuffle").playerApi.setShuffle(enabled).awaitVoid("Player.setShuffle")
  }

  suspend fun playerSetRepeatMode(mode: Int) {
    val repeatMode = when (mode) {
      0 -> Repeat.OFF
      1 -> Repeat.ONE
      2 -> Repeat.ALL
      else -> throw PlayerInvalidParameterException(
        "Player.setRepeatMode: invalid mode $mode — must be 0 (off), 1 (track), or 2 (context)"
      )
    }
    requireConnected("Player.setRepeatMode").playerApi.setRepeat(repeatMode).awaitVoid("Player.setRepeatMode")
  }

  suspend fun playerSetPodcastPlaybackSpeed(value: Float) {
    val speed = PlaybackSpeed.PodcastPlaybackSpeed.values().firstOrNull {
      // Accept either decimal multipliers (0.5, 1.2, ...) or integer percentages (50, 120, ...).
      abs((it.value / 100f) - value) < 0.01f || abs(it.value.toFloat() - value) < 0.01f
    }
      ?: throw PlayerInvalidParameterException(
        "Player.setPodcastPlaybackSpeed: unsupported speed $value. Available: ${
          PlaybackSpeed.PodcastPlaybackSpeed.values().joinToString { (it.value / 100f).toString() }
        }"
      )
    requireConnected("Player.setPodcastPlaybackSpeed").playerApi
      .setPodcastPlaybackSpeed(speed).awaitVoid("Player.setPodcastPlaybackSpeed")
  }

  suspend fun playerQueue(uri: String) {
    requireConnected("Player.queue").playerApi.queue(uri).awaitVoid("Player.queue")
  }

  suspend fun playerGetPlayerState(): Map<String, Any?> {
    val state = requireConnected("Player.getPlayerState").playerApi
      .playerState.awaitResult<PlayerState>("Player.getPlayerState")
    return playerStateToMap(state, this)
  }

  suspend fun playerGetCrossfadeState(): Map<String, Any?> {
    val state = requireConnected("Player.getCrossfadeState").playerApi
      .crossfadeState.awaitResult<CrossfadeState>("Player.getCrossfadeState")
    return mapOf("isEnabled" to state.isEnabled, "duration" to state.duration)
  }

  // MARK: — User operations

  suspend fun userGetCapabilities(): Map<String, Any?> {
    val capabilities = requireConnected("User.getCapabilities").userApi
      .capabilities.awaitUserResult("User.getCapabilities")
    return capabilitiesToMap(capabilities)
  }

  suspend fun userGetLibraryState(uri: String): Map<String, Any?> {
    val state = requireConnected("User.getLibraryState").userApi
      .getLibraryState(uri).awaitResult<LibraryState>("User.getLibraryState", uri)
    return libraryStateToMap(state)
  }

  suspend fun userAddToLibrary(uri: String): Map<String, Any?> {
    val remote = requireConnected("User.addToLibrary")
    remote.userApi.addToLibrary(uri).awaitVoid("User.addToLibrary")
    val state = remote.userApi.getLibraryState(uri).awaitResult<LibraryState>("User.addToLibrary", uri)
    return libraryStateToMap(state)
  }

  suspend fun userRemoveFromLibrary(uri: String): Map<String, Any?> {
    val remote = requireConnected("User.removeFromLibrary")
    remote.userApi.removeFromLibrary(uri).awaitVoid("User.removeFromLibrary")
    val state = remote.userApi.getLibraryState(uri).awaitResult<LibraryState>("User.removeFromLibrary", uri)
    return libraryStateToMap(state)
  }

  // MARK: — Content operations

  suspend fun contentGetRecommendedContentItems(type: String): List<Map<String, Any?>> {
    val remote = appRemote?.takeIf { it.isConnected } ?: throw ContentNotConnectedException("Content.getRecommendedContentItems")
    val mappedType = when (type) {
      "navigation" -> ContentApi.ContentType.NAVIGATION
      "fitness" -> ContentApi.ContentType.FITNESS
      "gaming" -> ContentApi.ContentType.DEFAULT
      else -> ContentApi.ContentType.DEFAULT
    }
    val listItems = remote.contentApi
      .getRecommendedContentItems(mappedType).awaitContentResult("Content.getRecommendedContentItems")
    return listItems.items.map(::contentItemToMap)
  }

  suspend fun contentGetChildren(item: Map<String, Any?>): List<Map<String, Any?>> {
    val remote = appRemote?.takeIf { it.isConnected } ?: throw ContentNotConnectedException("Content.getChildren")
    val listItem = mapToListItem(item)
    val listItems = remote.contentApi
      .getChildrenOfItem(listItem, 200, 0).awaitContentResult("Content.getChildren")
    return listItems.items.map(::contentItemToMap)
  }

  // MARK: — Images operations

  suspend fun imagesLoad(imageIdentifier: String, size: String, cacheDir: File): Map<String, Any?> {
    if (imageIdentifier.isBlank()) {
      throw ImagesInvalidURIException("Images.load: imageIdentifier must be non-empty")
    }
    val remote = appRemote?.takeIf { it.isConnected } ?: throw ImagesNotConnectedException("Images.load")
    val imageUri = ImageUri(imageIdentifier)
    val dimension = when (size) {
      "small" -> Image.Dimension.SMALL
      "medium" -> Image.Dimension.MEDIUM
      else -> Image.Dimension.LARGE
    }
    val bitmap = remote.imagesApi
      .getImage(imageUri, dimension).awaitImageResult("Images.load")
    return mapOf("uri" to writeBitmapToTempFile(bitmap, cacheDir).toURI().toString())
  }

  // MARK: — Internal helpers

  private fun requireConnected(callsite: String): SpotifyAppRemote {
    return appRemote?.takeIf { it.isConnected }
      ?: throw PlayerNotConnectedException(callsite)
  }

  private fun transitionState(state: String) {
    connectionState = state
    onConnectionStateChange?.invoke(state)
  }

  /** Awaits a [CallResult] that returns no meaningful value, normalising errors. */
  private suspend fun <T> CallResult<T>.awaitVoid(callsite: String) {
    suspendCancellableCoroutine { continuation ->
      setResultCallback { continuation.resume(Unit) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapPlayerError(throwable, callsite))
      }
    }
  }

  /** Awaits a [CallResult] and returns the result value, normalising errors. */
  @Suppress("UNCHECKED_CAST")
  private suspend fun <T> CallResult<T>.awaitResult(callsite: String): T {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapPlayerError(throwable, callsite))
      }
    }
  }

  @Suppress("UNCHECKED_CAST")
  private suspend fun <T> CallResult<T>.awaitResult(callsite: String, uri: String): T {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapUserError(throwable, callsite, uri))
      }
    }
  }

  private suspend fun CallResult<Capabilities>.awaitUserResult(callsite: String): Capabilities {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapUserError(throwable, callsite, ""))
      }
    }
  }

  private suspend fun CallResult<ListItems>.awaitContentResult(callsite: String): ListItems {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapContentError(throwable, callsite))
      }
    }
  }

  private suspend fun CallResult<Bitmap>.awaitImageResult(callsite: String): Bitmap {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(SpotifyAppRemoteErrorMapping.mapImagesError(throwable, callsite))
      }
    }
  }

  private fun writeBitmapToTempFile(bitmap: Bitmap, cacheDir: File): File {
    val out = File(cacheDir, "expo-spotify-image-${System.currentTimeMillis()}-${(0..9999).random()}.png")
    FileOutputStream(out).use { stream ->
      if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
        throw ImagesLoadFailedException("Images.load: failed to compress bitmap")
      }
      stream.flush()
    }
    return out
  }

  companion object {
    private fun playerStateToMap(
      state: PlayerState,
      coordinator: SpotifyAppRemoteCoordinator,
    ): Map<String, Any?> {
      val track = state.track
      val trackUri = track?.uri ?: ""
      val rawTrackName = track?.name?.trim().orEmpty()
      val sameTrackAsPrevious = coordinator.lastTrackUri == trackUri && trackUri.isNotBlank()
      val resolvedTrackName = when {
        rawTrackName.isNotBlank() -> {
          coordinator.lastTrackUri = trackUri
          coordinator.lastNonEmptyTrackName = rawTrackName
          rawTrackName
        }
        sameTrackAsPrevious && !coordinator.lastNonEmptyTrackName.isNullOrBlank() ->
          coordinator.lastNonEmptyTrackName!!
        else -> rawTrackName
      }

      val options = state.playbackOptions
      val restrictions = state.playbackRestrictions
      return mapOf(
        "track" to mapOf(
          "uri" to trackUri,
          "name" to resolvedTrackName,
          "imageIdentifier" to (track?.imageUri?.raw ?: ""),
          "duration" to (track?.duration ?: 0L),
          "artist" to mapOf(
            "name" to (track?.artist?.name ?: ""),
            "uri" to (track?.artist?.uri ?: ""),
          ),
          "album" to mapOf(
            "name" to (track?.album?.name ?: ""),
            "uri" to (track?.album?.uri ?: ""),
          ),
          "isEpisode" to (track?.isEpisode ?: false),
          "isPodcast" to (track?.isPodcast ?: false),
          "isSaved" to false,
          "isAdvertisement" to false,
        ),
        "playbackPosition" to state.playbackPosition,
        "playbackSpeed" to state.playbackSpeed,
        "isPaused" to state.isPaused,
        "playbackOptions" to mapOf(
          "isShuffling" to (options?.isShuffling ?: false),
          "repeatMode" to (options?.repeatMode ?: Repeat.OFF),
        ),
        "playbackRestrictions" to mapOf(
          "canSkipNext" to (restrictions?.canSkipNext ?: false),
          "canSkipPrevious" to (restrictions?.canSkipPrev ?: false),
          "canRepeatTrack" to (restrictions?.canRepeatTrack ?: false),
          "canRepeatContext" to (restrictions?.canRepeatContext ?: false),
          "canToggleShuffle" to (restrictions?.canToggleShuffle ?: false),
          "canSeek" to (restrictions?.canSeek ?: false),
        ),
        "contextTitle" to "",
        "contextUri" to "",
      )
    }

    private fun capabilitiesToMap(capabilities: Capabilities): Map<String, Any?> {
      return mapOf("canPlayOnDemand" to capabilities.canPlayOnDemand)
    }

    private fun libraryStateToMap(state: LibraryState): Map<String, Any?> {
      return mapOf("uri" to state.uri, "isAdded" to state.isAdded, "canAdd" to state.canAdd)
    }

    private fun contentItemToMap(item: ListItem): Map<String, Any?> {
      return mapOf(
        "title" to item.title,
        "subtitle" to item.subtitle,
        "contentDescription" to null,
        "identifier" to item.id,
        "uri" to item.uri,
        "imageIdentifier" to item.imageUri?.raw,
        "isAvailableOffline" to false,
        "isPlayable" to item.playable,
        "isContainer" to item.hasChildren,
        "isPinned" to false,
      )
    }

    private fun mapToListItem(item: Map<String, Any?>): ListItem {
      val id = (item["identifier"] as? String).orEmpty()
      val uri = (item["uri"] as? String).orEmpty()
      val title = (item["title"] as? String).orEmpty()
      val subtitle = (item["subtitle"] as? String).orEmpty()
      val imageIdentifier = item["imageIdentifier"] as? String
      val playable = item["isPlayable"] as? Boolean ?: false
      val isContainer = item["isContainer"] as? Boolean ?: false
      val imageUri = imageIdentifier?.takeIf { it.isNotBlank() }?.let(::ImageUri)
      return ListItem(id, uri, imageUri, title, subtitle, playable, isContainer)
    }
  }
}
