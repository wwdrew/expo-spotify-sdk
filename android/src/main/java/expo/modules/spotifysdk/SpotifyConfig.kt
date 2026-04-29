package expo.modules.spotifysdk

import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.Serializable

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

/**
 * Serializable input for the `AppContextActivityResultContract`. We need our
 * own class because `AuthorizationRequest` is only `Parcelable`, not
 * `Serializable`, and Expo's `AppContextActivityResultContract<I, O>` requires
 * `I : Serializable`.
 */
data class SpotifyAuthInput(
  val clientId: String,
  val redirectUri: String,
  val responseType: AuthorizationResponse.Type,
  val scopes: Array<String>,
) : Serializable {
  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other !is SpotifyAuthInput) return false
    return clientId == other.clientId &&
      redirectUri == other.redirectUri &&
      responseType == other.responseType &&
      scopes.contentEquals(other.scopes)
  }

  override fun hashCode(): Int {
    var result = clientId.hashCode()
    result = 31 * result + redirectUri.hashCode()
    result = 31 * result + responseType.hashCode()
    result = 31 * result + scopes.contentHashCode()
    return result
  }
}
