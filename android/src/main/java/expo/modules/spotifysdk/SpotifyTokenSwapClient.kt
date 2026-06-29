package expo.modules.spotifysdk

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.FormBody
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Performs the OAuth Authorization Code -> token swap and the refresh-token
 * exchange against a user-provided server.
 *
 * Server contract:
 *   POST {tokenSwapURL}
 *     body: code=<auth-code>
 *     200 -> { access_token, expires_in, refresh_token?, scope? }
 *
 *   POST {tokenRefreshURL}
 *     body: refresh_token=<token>
 *     200 -> { access_token, expires_in, refresh_token?, scope? }
 */
class SpotifyTokenSwapClient(
  private val sdkVersion: String,
) {
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .build()

  private val userAgent: String = "expo-spotify-sdk/$sdkVersion"

  suspend fun swap(
    code: String,
    tokenSwapURL: String,
    requestedScopes: List<String>,
  ): SpotifySessionPayload {
    val url = tokenSwapURL.toHttpUrlOrNull()
      ?: throw InvalidConfigException("Invalid token swap URL: $tokenSwapURL")
    val body = FormBody.Builder()
      .add("code", code)
      .build()
    val request = Request.Builder()
      .url(url)
      .header("User-Agent", userAgent)
      .post(body)
      .build()
    val json = executeJson(request)
    return parseSessionPayload(json, fallbackScopes = requestedScopes, fallbackRefreshToken = null)
  }

  suspend fun refresh(
    refreshToken: String,
    tokenRefreshURL: String,
    previousScopes: List<String>,
  ): SpotifySessionPayload {
    val url = tokenRefreshURL.toHttpUrlOrNull()
      ?: throw InvalidConfigException("Invalid token refresh URL: $tokenRefreshURL")
    val body = FormBody.Builder()
      .add("refresh_token", refreshToken)
      .build()
    val request = Request.Builder()
      .url(url)
      .header("User-Agent", userAgent)
      .post(body)
      .build()
    val json = executeJson(request, invalidGrantIsExpiredToken = true)
    return parseSessionPayload(
      json,
      fallbackScopes = previousScopes,
      fallbackRefreshToken = refreshToken,
    )
  }

  private suspend fun executeJson(
    request: Request,
    invalidGrantIsExpiredToken: Boolean = false,
  ): JSONObject {
    val response = try {
      client.executeAsync(request)
    } catch (e: IOException) {
      throw NetworkException("Network failure contacting ${request.url}", e)
    }
    response.use { res ->
      val raw = res.body?.string()
      if (!res.isSuccessful) {
        // On refresh, Spotify returns `invalid_grant` (HTTP 400) when the
        // refresh token has expired or been revoked — surface a dedicated code
        // so callers can route to sign-in. On the swap path the same body means
        // a bad authorization code, so this remap is scoped to refresh only.
        if (invalidGrantIsExpiredToken && raw?.contains("invalid_grant", ignoreCase = true) == true) {
          throw RefreshTokenExpiredException()
        }
        throw TokenSwapFailedException(res.code, raw)
      }
      if (raw.isNullOrBlank()) {
        throw TokenSwapParseException("Empty response body from ${request.url}")
      }
      return try {
        JSONObject(raw)
      } catch (e: JSONException) {
        throw TokenSwapParseException("Response was not valid JSON: ${raw.take(256)}", e)
      }
    }
  }

  private fun parseSessionPayload(
    json: JSONObject,
    fallbackScopes: List<String>,
    fallbackRefreshToken: String?,
  ): SpotifySessionPayload {
    val accessToken = json.optString("access_token").takeIf { it.isNotEmpty() }
      ?: throw TokenSwapParseException("Response missing required field: access_token")
    val expiresIn = json.optInt("expires_in", -1)
    if (expiresIn < 0) {
      throw TokenSwapParseException("Response missing required field: expires_in")
    }
    val refreshToken = json.optString("refresh_token").takeIf { it.isNotEmpty() }
      ?: fallbackRefreshToken
    val scopes = json.optString("scope").takeIf { it.isNotEmpty() }
      ?.split(' ')
      ?.filter { it.isNotEmpty() }
      ?: fallbackScopes
    val expirationDate = System.currentTimeMillis() + expiresIn * 1000L
    return SpotifySessionPayload(
      accessToken = accessToken,
      refreshToken = refreshToken,
      expirationDate = expirationDate,
      scopes = scopes,
    )
  }
}

/**
 * Suspend wrapper around `OkHttpClient.newCall(...).enqueue(...)`. Cancellation
 * of the surrounding coroutine cancels the in-flight call.
 */
internal suspend fun OkHttpClient.executeAsync(request: Request): Response =
  suspendCancellableCoroutine { cont ->
    val call = newCall(request)
    cont.invokeOnCancellation {
      try {
        call.cancel()
      } catch (_: Throwable) { /* best-effort */ }
    }
    call.enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        if (cont.isActive) cont.resumeWithException(e)
      }

      override fun onResponse(call: Call, response: Response) {
        if (cont.isActive) cont.resume(response)
      }
    })
  }
