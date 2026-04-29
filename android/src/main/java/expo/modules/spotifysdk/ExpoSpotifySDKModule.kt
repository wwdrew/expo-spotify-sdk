package expo.modules.spotifysdk

import android.content.pm.PackageManager
import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val SDK_VERSION = "0.5.0"
private const val EVENT_SESSION_CHANGE = "onSessionChange"

class ExpoSpotifySDKModule : Module() {

  private lateinit var authLauncher: AppContextActivityResultLauncher<SpotifyAuthInput, AuthorizationResponse>
  private val coordinator = SpotifyAuthCoordinator()

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun readManifestConfig(): SpotifyManifestConfig {
    val packageInfo = try {
      context.packageManager.getPackageInfo(
        context.packageName,
        PackageManager.GET_META_DATA,
      )
    } catch (e: PackageManager.NameNotFoundException) {
      throw InvalidConfigException("Failed to read application meta-data", e)
    }
    val metaData = packageInfo.applicationInfo?.metaData
      ?: throw InvalidConfigException("Application meta-data is missing")
    val clientId = metaData.getString("spotifyClientId")
      ?: throw InvalidConfigException(
        "Missing meta-data 'spotifyClientId' in AndroidManifest.xml. " +
          "Did you add @wwdrew/expo-spotify-sdk to your Expo plugins?",
      )
    val redirectUri = metaData.getString("spotifyRedirectUri")
      ?: throw InvalidConfigException(
        "Missing meta-data 'spotifyRedirectUri' in AndroidManifest.xml.",
      )
    return SpotifyManifestConfig(clientId = clientId, redirectUri = redirectUri)
  }

  private fun isSpotifyInstalled(): Boolean {
    return try {
      context.packageManager.getPackageInfo("com.spotify.music", 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
  }

  private fun emitSession(type: String, payload: SpotifySessionPayload) {
    sendEvent(
      EVENT_SESSION_CHANGE,
      mapOf("type" to type, "session" to payload.toMap()),
    )
  }

  private fun emitError(type: String, code: String, message: String) {
    sendEvent(
      EVENT_SESSION_CHANGE,
      mapOf("type" to type, "error" to mapOf("code" to code, "message" to message)),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoSpotifySDK")

    Events(EVENT_SESSION_CHANGE)

    Function("isAvailable") {
      isSpotifyInstalled()
    }

    RegisterActivityContracts {
      authLauncher = registerForActivityResult(SpotifyAuthorizationContract())
    }

    AsyncFunction("authenticateAsync") Coroutine { config: SpotifyAuthenticateOptions ->
      try {
        if (config.scopes.isEmpty()) {
          throw InvalidConfigException("`scopes` must contain at least one entry")
        }
        val manifest = readManifestConfig()

        val responseType =
          if (config.tokenSwapURL != null) AuthorizationResponse.Type.CODE
          else AuthorizationResponse.Type.TOKEN

        val input = SpotifyAuthInput(
          clientId = manifest.clientId,
          redirectUri = manifest.redirectUri,
          responseType = responseType,
          scopes = config.scopes.toTypedArray(),
          showDialog = config.showDialog,
        )

        val response = coordinator.authenticate(authLauncher, input)

        val payload = when (response.type) {
          AuthorizationResponse.Type.TOKEN -> SpotifySessionPayload(
            accessToken = response.accessToken
              ?: throw TokenSwapParseException("Spotify returned TOKEN without an access token"),
            refreshToken = null,
            expirationDate = System.currentTimeMillis() + response.expiresIn * 1000L,
            scopes = config.scopes,
          )
          AuthorizationResponse.Type.CODE -> {
            val swapURL = config.tokenSwapURL
              ?: throw InvalidConfigException(
                "Received CODE response but no tokenSwapURL was configured",
              )
            val client = SpotifyTokenSwapClient(SDK_VERSION, manifest.clientId)
            client.swap(
              code = response.code
                ?: throw TokenSwapParseException("Spotify returned CODE without a code"),
              redirectUri = manifest.redirectUri,
              tokenSwapURL = swapURL,
              requestedScopes = config.scopes,
            )
          }
          AuthorizationResponse.Type.CANCELLED -> throw UserCancelledException()
          AuthorizationResponse.Type.EMPTY -> throw UnknownSpotifyException(
            "Spotify returned an empty response (auth activity may have been killed)",
          )
          AuthorizationResponse.Type.ERROR -> throw SpotifyAuthErrorException(
            response.error ?: "Spotify returned an unspecified error",
          )
          AuthorizationResponse.Type.UNKNOWN, null -> throw UnknownSpotifyException(
            "Unknown Spotify authorization response type",
          )
        }
        emitSession("didInitiate", payload)
        payload.toMap()
      } catch (e: expo.modules.kotlin.exception.CodedException) {
        emitError("didFail", e.code ?: "UNKNOWN", e.localizedMessage ?: e.code ?: "Unknown error")
        throw e
      }
    }

    AsyncFunction("refreshSessionAsync") Coroutine { options: SpotifyRefreshOptions ->
      try {
        if (options.refreshToken.isBlank()) {
          throw InvalidConfigException("`refreshToken` is required")
        }
        if (options.tokenRefreshURL.isBlank()) {
          throw InvalidConfigException("`tokenRefreshURL` is required")
        }
        val manifest = readManifestConfig()
        val client = SpotifyTokenSwapClient(SDK_VERSION, manifest.clientId)
        val payload = client.refresh(
          refreshToken = options.refreshToken,
          tokenRefreshURL = options.tokenRefreshURL,
          previousScopes = emptyList(),
        )
        emitSession("didRenew", payload)
        payload.toMap()
      } catch (e: expo.modules.kotlin.exception.CodedException) {
        emitError("didFail", e.code ?: "UNKNOWN", e.localizedMessage ?: e.code ?: "Unknown error")
        throw e
      }
    }
  }
}
