package expo.modules.spotifysdk

import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.ModuleRegistry
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SpotifyConfigOptions : Record {
  @Field
  val tokenSwapURL: String? = null

  @Field
  val tokenRefreshURL: String? = null

  @Field
  val scopes: List<String> = emptyList()
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
      val packageManager: PackageManager = context.packageManager
      val intent = packageManager.getLaunchIntentForPackage("com.spotify.music")
      return@Function intent != null
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

        val request = AuthorizationRequest.Builder(
          clientId,
          AuthorizationResponse.Type.CODE,
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

        if (response.type == AuthorizationResponse.Type.TOKEN) {
          authPromise?.resolve(
            mapOf(
              "accessToken" to response.accessToken,
              "expiresIn" to response.expiresIn,
            )
          )
        } else {
          authPromise?.reject("ERR_SPOTIFY_AUTH", response.error, null)
        }

        authPromise = null
      }
    }
  }
}
