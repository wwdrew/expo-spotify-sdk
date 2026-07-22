package expo.modules.spotifysdk

import android.content.pm.PackageManager
import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val SDK_VERSION = "2.3.1" // x-release-please-version
private const val EVENT_SESSION_CHANGE = "onSessionChange"
private const val EVENT_CONNECTION_STATE_CHANGE = "onConnectionStateChange"
private const val EVENT_CONNECTION_ERROR = "onConnectionError"
private const val EVENT_PLAYER_STATE_CHANGE = "onPlayerStateChange"
private const val EVENT_CAPABILITIES_CHANGE = "onCapabilitiesChange"

class ExpoSpotifySDKModule : Module() {

  private lateinit var authLauncher: AppContextActivityResultLauncher<SpotifyAuthInput, AuthorizationResponse>
  private val authCoordinator = SpotifyAuthCoordinator()
  private val appRemoteCoordinator = SpotifyAppRemoteCoordinator()

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

  private fun emitSession(type: String, payload: SpotifySessionPayload) {
    sendEvent(
      EVENT_SESSION_CHANGE,
      mapOf("type" to type, "session" to payload.toMap()),
    )
  }

  private fun emitSessionError(code: String, message: String) {
    sendEvent(
      EVENT_SESSION_CHANGE,
      mapOf("type" to "didFail", "error" to mapOf("code" to code, "message" to message)),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoSpotifySDK")

    Events(
      EVENT_SESSION_CHANGE,
      EVENT_CONNECTION_STATE_CHANGE,
      EVENT_CONNECTION_ERROR,
      EVENT_PLAYER_STATE_CHANGE,
      EVENT_CAPABILITIES_CHANGE,
    )

    // Wire up App Remote coordinator event callbacks once the module is alive.
    OnCreate {
      appRemoteCoordinator.onConnectionStateChange = { state ->
        sendEvent(EVENT_CONNECTION_STATE_CHANGE, mapOf("state" to state))
      }
      appRemoteCoordinator.onConnectionError = { code, message ->
        sendEvent(EVENT_CONNECTION_ERROR, mapOf("code" to code, "message" to message))
      }
      appRemoteCoordinator.onPlayerStateChange = { stateMap ->
        sendEvent(EVENT_PLAYER_STATE_CHANGE, stateMap)
      }
      appRemoteCoordinator.onCapabilitiesChange = { capabilities ->
        sendEvent(EVENT_CAPABILITIES_CHANGE, capabilities)
      }
    }

    // ── Auth ────────────────────────────────────────────────────────────────

    Function("isAvailable") {
      SpotifyAuthAvailability.isAuthAvailable(context)
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
        SpotifyAuthAvailability.ensureAuthAvailable(context)

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

        val response = authCoordinator.authenticate(authLauncher, input)

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
            val client = SpotifyTokenSwapClient(SDK_VERSION)
            client.swap(
              code = response.code
                ?: throw TokenSwapParseException("Spotify returned CODE without a code"),
              tokenSwapURL = swapURL,
              requestedScopes = config.scopes,
            )
          }
          AuthorizationResponse.Type.CANCELLED -> throw UserCancelledException()
          AuthorizationResponse.Type.EMPTY -> throw UserCancelledException(
            "Spotify returned an empty response (auth activity dismissed before completion)",
          )
          AuthorizationResponse.Type.ERROR -> throw SpotifyAuthErrorException(
            response.error ?: "Spotify returned an unspecified error",
          )
          AuthorizationResponse.Type.UNKNOWN -> throw UnknownSpotifyException(
            "Unknown Spotify authorization response type",
          )
        }
        emitSession("didInitiate", payload)
        payload.toMap()
      } catch (e: expo.modules.kotlin.exception.CodedException) {
        emitSessionError(e.code ?: "UNKNOWN", e.localizedMessage ?: e.code ?: "Unknown error")
        throw e
      } catch (e: Exception) {
        val wrapped = UnknownSpotifyException(
          "Unexpected authentication error: ${e.message ?: e::class.java.simpleName}",
          e,
        )
        emitSessionError(wrapped.code ?: "UNKNOWN", wrapped.localizedMessage ?: "Unknown error")
        throw wrapped
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
        val client = SpotifyTokenSwapClient(SDK_VERSION)
        val payload = client.refresh(
          refreshToken = options.refreshToken,
          tokenRefreshURL = options.tokenRefreshURL,
          previousScopes = options.scopes,
        )
        emitSession("didRenew", payload)
        payload.toMap()
      } catch (e: expo.modules.kotlin.exception.CodedException) {
        emitSessionError(e.code ?: "UNKNOWN", e.localizedMessage ?: e.code ?: "Unknown error")
        throw e
      } catch (e: Exception) {
        val wrapped = UnknownSpotifyException(
          "Unexpected token refresh error: ${e.message ?: e::class.java.simpleName}",
          e,
        )
        emitSessionError(wrapped.code ?: "UNKNOWN", wrapped.localizedMessage ?: "Unknown error")
        throw wrapped
      }
    }

    // ── App Remote ──────────────────────────────────────────────────────────

    AsyncFunction("appRemoteConnect") Coroutine { accessToken: String ->
      val manifest = readManifestConfig()
      appRemoteCoordinator.connect(
        context = context,
        clientId = manifest.clientId,
        redirectUri = manifest.redirectUri,
        accessToken = accessToken,
      )
    }

    AsyncFunction("appRemoteAuthorizeAndPlay") Coroutine { accessToken: String, uri: String ->
      val manifest = readManifestConfig()
      appRemoteCoordinator.authorizeAndPlay(
        context = context,
        clientId = manifest.clientId,
        redirectUri = manifest.redirectUri,
        accessToken = accessToken,
        uri = uri,
      )
    }

    AsyncFunction("appRemoteDisconnect") Coroutine { ->
      appRemoteCoordinator.disconnect()
    }

    Function("appRemoteIsConnected") {
      appRemoteCoordinator.isConnected()
    }

    AsyncFunction("appRemoteGetConnectionState") Coroutine { ->
      appRemoteCoordinator.getConnectionState()
    }

    // ── Player ──────────────────────────────────────────────────────────────

    AsyncFunction("playerPlay") Coroutine { uri: String ->
      appRemoteCoordinator.playerPlay(uri)
    }

    AsyncFunction("playerPause") Coroutine { ->
      appRemoteCoordinator.playerPause()
    }

    AsyncFunction("playerResume") Coroutine { ->
      appRemoteCoordinator.playerResume()
    }

    AsyncFunction("playerSkipNext") Coroutine { ->
      appRemoteCoordinator.playerSkipNext()
    }

    AsyncFunction("playerSkipPrevious") Coroutine { ->
      appRemoteCoordinator.playerSkipPrevious()
    }

    AsyncFunction("playerSeekTo") Coroutine { positionMs: Long ->
      appRemoteCoordinator.playerSeekTo(positionMs)
    }

    AsyncFunction("playerSetShuffle") Coroutine { enabled: Boolean ->
      appRemoteCoordinator.playerSetShuffle(enabled)
    }

    AsyncFunction("playerSetRepeatMode") Coroutine { mode: Int ->
      appRemoteCoordinator.playerSetRepeatMode(mode)
    }

    AsyncFunction("playerSetPodcastPlaybackSpeed") Coroutine { value: Double ->
      appRemoteCoordinator.playerSetPodcastPlaybackSpeed(value.toFloat())
    }

    AsyncFunction("playerQueue") Coroutine { uri: String ->
      appRemoteCoordinator.playerQueue(uri)
    }

    AsyncFunction("playerGetPlayerState") Coroutine { ->
      appRemoteCoordinator.playerGetPlayerState()
    }

    AsyncFunction("playerGetCrossfadeState") Coroutine { ->
      appRemoteCoordinator.playerGetCrossfadeState()
    }

    // ── User ────────────────────────────────────────────────────────────────

    AsyncFunction("userGetCapabilities") Coroutine { ->
      appRemoteCoordinator.userGetCapabilities()
    }

    AsyncFunction("userGetLibraryState") Coroutine { uri: String ->
      appRemoteCoordinator.userGetLibraryState(uri)
    }

    AsyncFunction("userAddToLibrary") Coroutine { uri: String ->
      appRemoteCoordinator.userAddToLibrary(uri)
    }

    AsyncFunction("userRemoveFromLibrary") Coroutine { uri: String ->
      appRemoteCoordinator.userRemoveFromLibrary(uri)
    }

    // ── Content ───────────────────────────────────────────────────────────────

    AsyncFunction("contentGetRecommendedContentItems") Coroutine { type: String ->
      appRemoteCoordinator.contentGetRecommendedContentItems(type)
    }

    AsyncFunction("contentGetChildren") Coroutine { item: Map<String, Any?> ->
      appRemoteCoordinator.contentGetChildren(item)
    }

    // ── Images ────────────────────────────────────────────────────────────────

    AsyncFunction("imagesLoad") Coroutine { imageIdentifier: String, size: String ->
      appRemoteCoordinator.imagesLoad(imageIdentifier, size, context.cacheDir)
    }
  }
}
