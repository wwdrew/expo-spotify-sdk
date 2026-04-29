package expo.modules.spotifysdk

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.activityresult.AppContextActivityResultContract

/**
 * Expo-compatible wrapper around Spotify's auth flow.
 *
 * `AppContextActivityResultContract<I, O>` is the Expo Modules Core version of
 * AndroidX's `ActivityResultContract`. The key difference is that:
 *  - `I` must implement `Serializable` (for state preservation across process death)
 *  - `parseResult` receives the original `input` as its first argument
 *
 * We use `SpotifyAuthInput` as our serializable input type to work around
 * `AuthorizationRequest` only implementing `Parcelable`.
 */
class SpotifyAuthorizationContract :
  AppContextActivityResultContract<SpotifyAuthInput, AuthorizationResponse> {

  override fun createIntent(context: Context, input: SpotifyAuthInput): Intent {
    val activity = context as? Activity
      ?: throw IllegalStateException(
        "SpotifyAuthorizationContract requires an Activity context, got ${context.javaClass.name}"
      )
    val request = AuthorizationRequest.Builder(
      input.clientId,
      input.responseType,
      input.redirectUri,
    )
      .setScopes(input.scopes)
      .build()
    return AuthorizationClient.createLoginActivityIntent(activity, request)
  }

  override fun parseResult(
    input: SpotifyAuthInput,
    resultCode: Int,
    intent: Intent?,
  ): AuthorizationResponse = AuthorizationClient.getResponse(resultCode, intent)
}
