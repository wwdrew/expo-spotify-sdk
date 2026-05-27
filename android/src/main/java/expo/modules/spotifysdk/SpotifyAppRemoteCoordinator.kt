package expo.modules.spotifysdk

import android.content.Context
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Manages the [SpotifyAppRemote] singleton and the IPC connection lifecycle to
 * the Spotify app. Mirrors the design of [SpotifyAuthCoordinator].
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

  /** Injected by the module to forward state-change events to JS. */
  var onConnectionStateChange: ((String) -> Unit)? = null

  /** Injected by the module to forward error events to JS. */
  var onConnectionError: ((String, String) -> Unit)? = null

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
    val remote = appRemote ?: return
    appRemote = null
    SpotifyAppRemote.disconnect(remote)
    transitionState("disconnected")
  }

  private fun transitionState(state: String) {
    connectionState = state
    onConnectionStateChange?.invoke(state)
  }
}
