package expo.modules.spotifysdk

import androidx.activity.result.ActivityResultLauncher
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume

/**
 * Single point of truth for an in-flight Spotify auth call.
 *
 * - Only one `authenticate` call may be in flight at a time (`Mutex`).
 * - The continuation is consumed exactly once by `deliverResult`.
 * - The launcher is supplied by the Expo module's `RegisterActivityContracts`
 *   block and is invoked from inside the suspending body, ensuring the
 *   activity is launched after the continuation has been registered.
 */
class SpotifyAuthCoordinator {
  private val mutex = Mutex()

  @Volatile
  private var pending: CancellableContinuation<AuthorizationResponse>? = null

  /**
   * Launches the Spotify auth flow and suspends until the activity returns a
   * result. Re-entry while a call is in flight rejects with [AuthInProgressException].
   */
  suspend fun authenticate(
    launcher: ActivityResultLauncher<AuthorizationRequest>,
    request: AuthorizationRequest,
  ): AuthorizationResponse {
    if (!mutex.tryLock()) {
      throw AuthInProgressException()
    }
    try {
      return suspendCancellableCoroutine { cont ->
        pending = cont
        cont.invokeOnCancellation {
          if (pending === cont) pending = null
        }
        try {
          launcher.launch(request)
        } catch (t: Throwable) {
          if (pending === cont) pending = null
          if (cont.isActive) cont.resumeWith(Result.failure(t))
        }
      }
    } finally {
      mutex.unlock()
    }
  }

  /**
   * Called from the activity-result callback registered via
   * `RegisterActivityContracts`. Delivers the result to the suspended caller
   * (if any). Stale results (e.g. from a cancelled previous call) are ignored.
   */
  fun deliverResult(response: AuthorizationResponse) {
    val cont = pending
    pending = null
    if (cont != null && cont.isActive) {
      cont.resume(response)
    }
  }
}
