package expo.modules.spotifysdk

import android.content.Context
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.CallResult
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.CrossfadeState
import com.spotify.protocol.types.PlayerState
import com.spotify.protocol.types.PodcastPlaybackSpeed
import com.spotify.protocol.types.Repeat
import expo.modules.kotlin.exception.CodedException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
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

  /** Injected by the module to forward connection state-change events to JS. */
  var onConnectionStateChange: ((String) -> Unit)? = null

  /** Injected by the module to forward connection error events to JS. */
  var onConnectionError: ((String, String) -> Unit)? = null

  /** Injected by the module to forward player state change events to JS. */
  var onPlayerStateChange: ((Map<String, Any?>) -> Unit)? = null

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
   * Disconnects from the Spotify app. Safe to call when already disconnected.
   */
  fun disconnect() {
    cancelPlayerStateSubscription()
    val remote = appRemote ?: return
    appRemote = null
    SpotifyAppRemote.disconnect(remote)
    transitionState("disconnected")
  }

  // MARK: — Player subscription

  private fun subscribeToPlayerState(remote: SpotifyAppRemote) {
    playerStateSubscription = remote.playerApi
      .subscribeToPlayerState()
      .setEventCallback { playerState ->
        onPlayerStateChange?.invoke(playerStateToMap(playerState))
      }
      .setErrorCallback { /* subscription errors are non-fatal; connection errors handled separately */ }
  }

  private fun cancelPlayerStateSubscription() {
    playerStateSubscription?.cancel()
    playerStateSubscription = null
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
    val speed = PodcastPlaybackSpeed.entries.firstOrNull { abs(it.value - value) < 0.01f }
      ?: throw PlayerInvalidParameterException(
        "Player.setPodcastPlaybackSpeed: unsupported speed $value. Available: ${PodcastPlaybackSpeed.entries.map { it.value }}"
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
    return playerStateToMap(state)
  }

  suspend fun playerGetCrossfadeState(): Map<String, Any?> {
    val state = requireConnected("Player.getCrossfadeState").playerApi
      .crossfadeState.awaitResult<CrossfadeState>("Player.getCrossfadeState")
    return mapOf("isEnabled" to state.isEnabled, "duration" to state.duration)
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
        continuation.resumeWithException(normalizePlayerError(throwable, callsite))
      }
    }
  }

  /** Awaits a [CallResult] and returns the result value, normalising errors. */
  @Suppress("UNCHECKED_CAST")
  private suspend fun <T> CallResult<T>.awaitResult(callsite: String): T {
    return suspendCancellableCoroutine { continuation ->
      setResultCallback { result -> continuation.resume(result) }
      setErrorCallback { throwable ->
        continuation.resumeWithException(normalizePlayerError(throwable, callsite))
      }
    }
  }

  private fun normalizePlayerError(throwable: Throwable, callsite: String): CodedException {
    val msg = throwable.message ?: "Unknown error"
    return when {
      msg.contains("premium", ignoreCase = true) -> PlayerPremiumRequiredException(callsite)
      msg.contains("disconnected", ignoreCase = true) ||
        msg.contains("not connected", ignoreCase = true) ->
        PlayerConnectionLostException("$callsite: $msg", throwable)
      msg.contains("not allowed", ignoreCase = true) ||
        msg.contains("restriction", ignoreCase = true) ->
        PlayerOperationNotAllowedException("$callsite: $msg", throwable)
      else -> PlayerUnknownException("$callsite: $msg", throwable)
    }
  }

  companion object {
    private fun playerStateToMap(state: PlayerState): Map<String, Any?> {
      val track = state.track
      val options = state.playbackOptions
      val restrictions = state.playbackRestrictions
      return mapOf(
        "track" to mapOf(
          "uri" to (track?.uri ?: ""),
          "name" to (track?.name ?: ""),
          "duration" to (track?.duration ?: 0L),
          "artist" to mapOf(
            "name" to (track?.artist?.name ?: ""),
            "uri" to (track?.artist?.uri ?: ""),
          ),
          "album" to mapOf(
            "name" to (track?.album?.name ?: ""),
            "uri" to (track?.album?.uri ?: ""),
          ),
          "isSaved" to (track?.isSaved ?: false),
          "isEpisode" to (track?.isEpisode ?: false),
          "isPodcast" to (track?.isPodcast ?: false),
          "isAdvertisement" to (track?.isAd ?: false),
        ),
        "playbackPosition" to state.playbackPosition,
        "playbackSpeed" to state.playbackSpeed,
        "isPaused" to state.isPaused,
        "playbackOptions" to mapOf(
          "isShuffling" to (options?.isShuffling ?: false),
          "repeatMode" to (options?.repeatMode?.ordinal ?: 0),
        ),
        "playbackRestrictions" to mapOf(
          "canSkipNext" to (restrictions?.canSkipNext ?: false),
          "canSkipPrevious" to (restrictions?.canSkipPrevious ?: false),
          "canRepeatTrack" to (restrictions?.canRepeatTrack ?: false),
          "canRepeatContext" to (restrictions?.canRepeatContext ?: false),
          "canToggleShuffle" to (restrictions?.canToggleShuffle ?: false),
          "canSeek" to (restrictions?.canSeek ?: false),
        ),
        "contextTitle" to (state.contextTitle ?: ""),
        "contextUri" to (state.contextUri ?: ""),
      )
    }
  }
}
