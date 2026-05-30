package expo.modules.spotifysdk

import com.spotify.android.appremote.api.error.SpotifyConnectionTerminatedException
import com.spotify.android.appremote.api.error.SpotifyDisconnectedException
import com.spotify.android.appremote.api.error.SpotifyRemoteServiceException
import com.spotify.protocol.client.error.RemoteClientException
import com.spotify.protocol.error.SpotifyAppRemoteException
import expo.modules.kotlin.exception.CodedException

/**
 * Maps Spotify App Remote SDK throwables into per-namespace [CodedException] types.
 *
 * Typed SDK exceptions are checked first; message heuristics are a fallback aligned
 * with [ios/SpotifyAppRemoteErrorMapping.swift]. See [docs/app-remote-error-mapping.md].
 */
object SpotifyAppRemoteErrorMapping {
  private fun connectionLostMessage(callsite: String): String =
    "$callsite: connection to Spotify app was terminated"

  private fun isConnectionTerminated(throwable: Throwable): Boolean =
    throwable is SpotifyConnectionTerminatedException ||
      throwable is SpotifyDisconnectedException

  private fun messageIndicatesConnectionLost(message: String): Boolean {
    val lower = message.lowercase()
    return lower.contains("disconnected") || lower.contains("not connected")
  }

  private fun containsRestriction(message: String): Boolean {
    val lower = message.lowercase()
    return lower.contains("not allowed") || lower.contains("restriction")
  }

  /** Request-level failures from the Spotify protocol layer (mirrors iOS `requestFailedError`). */
  private fun isRequestFailed(throwable: Throwable): Boolean =
    throwable is RemoteClientException ||
      throwable is SpotifyAppRemoteException ||
      throwable is SpotifyRemoteServiceException

  fun mapPlayerError(throwable: Throwable, callsite: String): CodedException {
    val message = throwable.message ?: "Unknown error"
    if (isConnectionTerminated(throwable) || messageIndicatesConnectionLost(message)) {
      return PlayerConnectionLostException(connectionLostMessage(callsite), throwable)
    }
    if (message.contains("premium", ignoreCase = true)) {
      return PlayerPremiumRequiredException(
        "$callsite: Spotify Premium is required for on-demand playback",
      )
    }
    if (containsRestriction(message)) {
      return PlayerOperationNotAllowedException("$callsite: $message", throwable)
    }
    if (isRequestFailed(throwable) && message.contains("invalid", ignoreCase = true)) {
      return PlayerInvalidParameterException("$callsite: $message", throwable)
    }
    return PlayerUnknownException("$callsite: $message", throwable)
  }

  fun mapUserError(throwable: Throwable, callsite: String, uri: String): CodedException {
    val message = throwable.message ?: "Unknown error"
    if (isConnectionTerminated(throwable) || messageIndicatesConnectionLost(message)) {
      return UserConnectionLostException(connectionLostMessage(callsite), throwable)
    }
    if (
      isRequestFailed(throwable) &&
      (message.contains("uri", ignoreCase = true) || message.contains("invalid", ignoreCase = true))
    ) {
      return UserInvalidURIException(uri, throwable)
    }
    if (containsRestriction(message)) {
      return UserOperationNotAllowedException("$callsite: $message", throwable)
    }
    return UserUnknownException("$callsite: $message", throwable)
  }

  fun mapContentError(throwable: Throwable, callsite: String): CodedException {
    val message = throwable.message ?: "Unknown error"
    if (isConnectionTerminated(throwable) || messageIndicatesConnectionLost(message)) {
      return ContentConnectionLostException(connectionLostMessage(callsite), throwable)
    }
    if (isRequestFailed(throwable)) {
      val lower = message.lowercase()
      if (lower.contains("not supported") || lower.contains("unsupported")) {
        return ContentApiUnavailableException(
          "$callsite: content API is unavailable on this Spotify app version",
          throwable,
        )
      }
    }
    return ContentUnknownException("$callsite: $message", throwable)
  }

  fun mapImagesError(throwable: Throwable, callsite: String): CodedException {
    val message = throwable.message ?: "Unknown error"
    if (isConnectionTerminated(throwable) || messageIndicatesConnectionLost(message)) {
      return ImagesNotConnectedException(connectionLostMessage(callsite))
    }
    if (isRequestFailed(throwable) && message.contains("invalid", ignoreCase = true)) {
      return ImagesInvalidURIException("$callsite: invalid image identifier", throwable)
    }
    if (isRequestFailed(throwable)) {
      return ImagesLoadFailedException("$callsite: Spotify rejected image request", throwable)
    }
    return ImagesUnknownException("$callsite: $message", throwable)
  }
}
