package expo.modules.spotifysdk

import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Guards against concurrent Spotify auth calls.
 *
 * `AppContextActivityResultLauncher.launch(input)` is already a `suspend`
 * function that bridges the activity-result callback into a coroutine, so we
 * no longer need `suspendCancellableCoroutine` here. The only responsibility
 * of this class is to enforce the single-in-flight constraint via `Mutex`.
 */
class SpotifyAuthCoordinator {
  private val mutex = Mutex()

  /**
   * Launches the Spotify auth flow and suspends until the activity returns a
   * result. Re-entry while a call is in flight rejects with [AuthInProgressException].
   */
  suspend fun authenticate(
    launcher: AppContextActivityResultLauncher<SpotifyAuthInput, AuthorizationResponse>,
    input: SpotifyAuthInput,
  ): AuthorizationResponse {
    if (!mutex.tryLock()) {
      throw AuthInProgressException()
    }
    return try {
      launcher.launch(input)
    } finally {
      mutex.unlock()
    }
  }
}
