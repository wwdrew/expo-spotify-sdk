package expo.modules.spotifysdk

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.activity.result.contract.ActivityResultContract
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse

/**
 * Type-safe wrapper around Spotify's `AuthorizationClient` so the auth flow
 * can be launched and observed via the modern AndroidX `ActivityResultContract`
 * APIs registered through Expo's `RegisterActivityContracts` block.
 *
 * `createIntent` requires an `Activity` (not a plain `Context`); when the
 * platform invokes `createIntent` it passes the host activity, so we cast.
 */
class SpotifyAuthorizationContract :
  ActivityResultContract<AuthorizationRequest, AuthorizationResponse>() {

  override fun createIntent(context: Context, input: AuthorizationRequest): Intent {
    val activity = context as? Activity
      ?: throw IllegalStateException(
        "SpotifyAuthorizationContract requires an Activity context, got ${context.javaClass.name}"
      )
    return AuthorizationClient.createLoginActivityIntent(activity, input)
  }

  override fun parseResult(resultCode: Int, intent: Intent?): AuthorizationResponse =
    AuthorizationClient.getResponse(resultCode, intent)
}
