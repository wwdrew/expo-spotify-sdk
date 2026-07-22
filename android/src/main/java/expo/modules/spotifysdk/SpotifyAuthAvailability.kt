package expo.modules.spotifysdk

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

/**
 * Checks whether Spotify auth can start without hitting the Spotify SDK's
 * browser fallback crash (ActivityNotFoundException when no handler exists for
 * https://accounts.spotify.com).
 */
object SpotifyAuthAvailability {
  private const val SPOTIFY_PACKAGE = "com.spotify.music"

  /** Same URL the Spotify auth SDK opens in Custom Tabs / browser fallback. */
  private val SPOTIFY_ACCOUNTS_URI: Uri = Uri.parse("https://accounts.spotify.com")

  fun isSpotifyInstalled(packageManager: PackageManager): Boolean {
    return try {
      packageManager.getPackageInfo(SPOTIFY_PACKAGE, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
  }

  /**
   * Returns true when some app on the device can handle Spotify's web auth URL.
   * Requires the module manifest `<queries>` for https VIEW intents on Android 11+.
   */
  fun canOpenSpotifyAuthInBrowser(packageManager: PackageManager): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, SPOTIFY_ACCOUNTS_URI).apply {
      addCategory(Intent.CATEGORY_BROWSABLE)
    }
    return packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) != null
  }

  /** Native Spotify app auth, or web fallback via an installed browser. */
  fun isAuthAvailable(context: Context): Boolean {
    val packageManager = context.packageManager
    return isSpotifyInstalled(packageManager) || canOpenSpotifyAuthInBrowser(packageManager)
  }

  /**
   * Throws [SpotifyNotInstalledException] before launching LoginActivity when
   * neither auth path is available — avoids an uncaught native crash inside the
   * Spotify auth SDK's browser fallback handler.
   */
  fun ensureAuthAvailable(context: Context) {
    if (isAuthAvailable(context)) {
      return
    }
    throw SpotifyNotInstalledException(
      "The Spotify app is not installed and no browser is available to complete sign-in",
    )
  }
}
