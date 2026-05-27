package expo.modules.spotifysdk

import expo.modules.kotlin.exception.CodedException

class UserCancelledException(message: String = "Authentication was cancelled by the user") :
  CodedException("USER_CANCELLED", message, null)

class AuthInProgressException(message: String = "Another authentication request is already in progress") :
  CodedException("AUTH_IN_PROGRESS", message, null)

class InvalidConfigException(message: String, cause: Throwable? = null) :
  CodedException("INVALID_CONFIG", message, cause)

class NetworkException(message: String, cause: Throwable? = null) :
  CodedException("NETWORK_ERROR", message, cause)

class TokenSwapFailedException(status: Int, body: String?) :
  CodedException(
    "TOKEN_SWAP_FAILED",
    "Token swap server returned HTTP $status${if (!body.isNullOrBlank()) ": ${body.take(512)}" else ""}",
    null,
  )

class TokenSwapParseException(message: String, cause: Throwable? = null) :
  CodedException("TOKEN_SWAP_PARSE_ERROR", message, cause)

class SpotifyNotInstalledException(message: String = "The Spotify app is not installed on this device") :
  CodedException("SPOTIFY_NOT_INSTALLED", message, null)

class SpotifyAuthErrorException(error: String) :
  CodedException("AUTH_ERROR", error, null)

class UnknownSpotifyException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)

// ── App Remote errors ────────────────────────────────────────────────────────

class AppRemoteConnectionFailedException(message: String, cause: Throwable? = null) :
  CodedException("CONNECTION_FAILED", message, cause)

class AppRemoteConnectionLostException(message: String, cause: Throwable? = null) :
  CodedException("CONNECTION_LOST", message, cause)

class AppRemoteNotConnectedException(callsite: String = "") :
  CodedException(
    "NOT_CONNECTED",
    if (callsite.isNotBlank()) "Not connected to the Spotify app — call AppRemote.connect() before $callsite"
    else "Not connected to the Spotify app. Call AppRemote.connect() first.",
    null,
  )

class AppRemoteUnknownException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)
