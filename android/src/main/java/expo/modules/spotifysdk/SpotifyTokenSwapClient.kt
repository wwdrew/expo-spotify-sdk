package expo.modules.spotifysdk

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.FormBody
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
 *     body: code=<auth-code>&redirect_uri=<redirect-uri>&client_id=<client-id>
 *     200 -> { access_token, expires_in, refresh_token?, scope? }
 *
 *   POST {tokenRefreshURL}
 *     body: refresh_token=<token>&client_id=<client-id>
 *     200 -> { access_token, expires_in, refresh_token?, scope? }
 */
class SpotifyTokenSwapClient(
  private val sdkVersion: String,
  private val clientId: String,
) {
  private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .build()

  private val userAgent: String = "expo-spotify-sdk/$sdkVersion"

  suspend fun swap(
    code: String,
    redirectUri: String,
    tokenSwapURL: String,
    requestedScopes: List<String>,
  ): SpotifySessionPayload {
    val body = FormBody.Builder()
      .add("code", code)
      .add("redirect_uri", redirectUri)
      .add("client_id", clientId)
      .build()
    val request = Request.Builder()
      .url(tokenSwapURL)
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
    val body = FormBody.Builder()
      .add("refresh_token", refreshToken)
      .add("client_id", clientId)
      .build()
    val request = Request.Builder()
      .url(tokenRefreshURL)
      .header("User-Agent", userAgent)
      .post(body)
      .build()
    val json = executeJson(request)
    return parseSessionPayload(
      json,
      fallbackScopes = previousScopes,
      fallbackRefreshToken = refreshToken,
    )
  }

  private suspend fun executeJson(request: Request): JSONObject {
    val response = try {
      client.executeAsync(request)
    } catch (e: IOException) {
      throw NetworkException("Network failure contacting ${request.url}", e)
    }
    response.use { res ->
      val raw = res.body?.string()
      if (!res.isSuccessful) {
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
