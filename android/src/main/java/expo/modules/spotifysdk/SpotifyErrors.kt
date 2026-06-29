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

class RefreshTokenExpiredException :
  CodedException(
    "REFRESH_TOKEN_EXPIRED",
    "The refresh token is no longer valid (expired or revoked). The user must sign in again.",
    null,
  )

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

// ── Player errors ─────────────────────────────────────────────────────────────

class PlayerNotConnectedException(callsite: String = "") :
  CodedException(
    "NOT_CONNECTED",
    if (callsite.isNotBlank()) "Not connected to the Spotify app — call AppRemote.connect() before $callsite"
    else "Not connected to the Spotify app. Call AppRemote.connect() first.",
    null,
  )

class PlayerConnectionLostException(message: String, cause: Throwable? = null) :
  CodedException("CONNECTION_LOST", message, cause)

class PlayerPremiumRequiredException(callsite: String = "") :
  CodedException(
    "PREMIUM_REQUIRED",
    if (callsite.isNotBlank()) "$callsite: Spotify Premium is required for on-demand playback"
    else "Spotify Premium is required for on-demand playback",
    null,
  )

class PlayerInvalidURIException(uri: String, cause: Throwable? = null) :
  CodedException("INVALID_URI", "Invalid Spotify URI: $uri", cause)

class PlayerInvalidParameterException(message: String, cause: Throwable? = null) :
  CodedException("INVALID_PARAMETER", message, cause)

class PlayerOperationNotAllowedException(message: String, cause: Throwable? = null) :
  CodedException("OPERATION_NOT_ALLOWED", message, cause)

class PlayerUnknownException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)

// ── User errors ───────────────────────────────────────────────────────────────

class UserNotConnectedException(callsite: String = "") :
  CodedException(
    "NOT_CONNECTED",
    if (callsite.isNotBlank()) "Not connected to the Spotify app — call AppRemote.connect() before $callsite"
    else "Not connected to the Spotify app. Call AppRemote.connect() first.",
    null,
  )

class UserConnectionLostException(message: String, cause: Throwable? = null) :
  CodedException("CONNECTION_LOST", message, cause)

class UserInvalidURIException(uri: String, cause: Throwable? = null) :
  CodedException("INVALID_URI", "Invalid Spotify URI: $uri", cause)

class UserOperationNotAllowedException(message: String, cause: Throwable? = null) :
  CodedException("OPERATION_NOT_ALLOWED", message, cause)

class UserUnknownException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)

// ── Content errors ────────────────────────────────────────────────────────────

class ContentNotConnectedException(callsite: String = "") :
  CodedException(
    "NOT_CONNECTED",
    if (callsite.isNotBlank()) "Not connected to the Spotify app — call AppRemote.connect() before $callsite"
    else "Not connected to the Spotify app. Call AppRemote.connect() first.",
    null,
  )

class ContentConnectionLostException(message: String, cause: Throwable? = null) :
  CodedException("CONNECTION_LOST", message, cause)

class ContentApiUnavailableException(message: String, cause: Throwable? = null) :
  CodedException("CONTENT_API_UNAVAILABLE", message, cause)

class ContentUnknownException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)

// ── Images errors ─────────────────────────────────────────────────────────────

class ImagesNotConnectedException(callsite: String = "") :
  CodedException(
    "NOT_CONNECTED",
    if (callsite.isNotBlank()) "Not connected to the Spotify app — call AppRemote.connect() before $callsite"
    else "Not connected to the Spotify app. Call AppRemote.connect() first.",
    null,
  )

class ImagesInvalidURIException(message: String, cause: Throwable? = null) :
  CodedException("INVALID_URI", message, cause)

class ImagesLoadFailedException(message: String, cause: Throwable? = null) :
  CodedException("IMAGE_LOAD_FAILED", message, cause)

class ImagesUnknownException(message: String, cause: Throwable? = null) :
  CodedException("UNKNOWN", message, cause)
