package expo.modules.spotifysdk

import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import com.spotify.sdk.android.auth.app.SpotifyNativeAuthUtil
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SpotifyConfigOptions : Record {
  @Field
  val scopes: List<String> = emptyList()

  @Field
  val tokenSwapURL: String? = null

  @Field
  val tokenRefreshURL: String? = null
}

class ExpoSpotifySDKModule : Module() {

  private val requestCode = 2095
  private var authPromise: Promise? = null
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val currentActivity
    get() = appContext.currentActivity ?: throw Exceptions.MissingActivity()

  override fun definition() = ModuleDefinition {

    Name("ExpoSpotifySDK")

    Function("isAvailable") {
      return@Function SpotifyNativeAuthUtil.isSpotifyInstalled(context)
    }

    AsyncFunction("authenticateAsync") { config: SpotifyConfigOptions, promise: Promise ->
      try {
        val packageInfo =
          context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_META_DATA)
        val applicationInfo = packageInfo.applicationInfo
        val metaData = applicationInfo.metaData
        val clientId = metaData.getString("spotifyClientId")
        val redirectUri = metaData.getString("spotifyRedirectUri")

        if (clientId == null || redirectUri == null) {
          promise.reject(
            "ERR_SPOTIFY_SDK",
            "Missing Spotify configuration in AndroidManifest.xml. Ensure SPOTIFY_CLIENT_ID and SPOTIFY_REDIRECT_URI are set.",
            null
          )
          return@AsyncFunction
        }

        val responseType = if (config.tokenSwapURL != null || config.tokenRefreshURL != null) {
          AuthorizationResponse.Type.CODE
        } else {
          AuthorizationResponse.Type.TOKEN
        }

        val request = AuthorizationRequest.Builder(
          clientId,
          responseType,
          redirectUri
        )
          .setScopes(config.scopes.toTypedArray())
          .build()

        authPromise = promise
        AuthorizationClient.openLoginActivity(currentActivity, requestCode, request)

      } catch (e: PackageManager.NameNotFoundException) {
        promise.reject(
          "ERR_SPOTIFY_SDK",
          "Missing Spotify configuration in AndroidManifest.xml",
          e
        )
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == requestCode) {
        val response = AuthorizationClient.getResponse(payload.resultCode, payload.data)

        when (response.type) {
          AuthorizationResponse.Type.TOKEN -> {
            authPromise?.resolve(
              mapOf(
                "type" to response.type.name,
                "accessToken" to response.accessToken,
                "expiresIn" to response.expiresIn,
                "state" to response.state
              )
            )
          }

          AuthorizationResponse.Type.CODE -> {
            authPromise?.resolve(
              mapOf(
                "type" to response.type.name,
                "code" to response.code,
                "state" to response.state
              )
            )
          }

          AuthorizationResponse.Type.ERROR -> {
            authPromise?.reject("ERR_SPOTIFY_AUTH", response.error, null)
          }

          else -> {
            authPromise?.reject("ERR_SPOTIFY_AUTH", "Unknown response type", null)
          }
        }
        authPromise = null
      }
    }
  }
}
