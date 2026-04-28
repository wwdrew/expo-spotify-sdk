package expo.modules.spotifysdk

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * JS-facing input for `authenticateAsync`.
 */
class SpotifyAuthenticateOptions : Record {
  @Field val scopes: List<String> = emptyList()
  @Field val tokenSwapURL: String? = null
  @Field val tokenRefreshURL: String? = null
}

/**
 * JS-facing input for `refreshSessionAsync`. Phase 1 ships the Kotlin support;
 * the public JS function is added in Phase 3.
 */
class SpotifyRefreshOptions : Record {
  @Field val refreshToken: String = ""
  @Field val tokenRefreshURL: String = ""
}

/**
 * Result shape returned to JS. Mirrors `SpotifySession` in the TypeScript layer.
 */
data class SpotifySessionPayload(
  val accessToken: String,
  val refreshToken: String?,
  val expirationDate: Long,
  val scopes: List<String>,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "accessToken" to accessToken,
    "refreshToken" to refreshToken,
    "expirationDate" to expirationDate,
    "scopes" to scopes,
  )
}

/**
 * Native config read from `AndroidManifest.xml` meta-data placeholders set
 * by the Expo config plugin.
 */
data class SpotifyManifestConfig(
  val clientId: String,
  val redirectUri: String,
)
