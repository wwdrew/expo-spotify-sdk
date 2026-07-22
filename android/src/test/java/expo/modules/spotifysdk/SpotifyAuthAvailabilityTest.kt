package expo.modules.spotifysdk

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.R])
class SpotifyAuthAvailabilityTest {
  private val spotifyPackage = "com.spotify.music"
  private val accountsUri = Uri.parse("https://accounts.spotify.com")

  private fun browserIntent(): Intent =
    Intent(Intent.ACTION_VIEW, accountsUri).apply {
      addCategory(Intent.CATEGORY_BROWSABLE)
    }

  private fun packageManagerWith(
    spotifyInstalled: Boolean,
    browserAvailable: Boolean,
  ): PackageManager {
    val packageManager = mock<PackageManager>()
    if (spotifyInstalled) {
      whenever(packageManager.getPackageInfo(spotifyPackage, 0)).thenReturn(mock())
    } else {
      whenever(packageManager.getPackageInfo(spotifyPackage, 0))
        .thenThrow(PackageManager.NameNotFoundException())
    }
    whenever(
      packageManager.resolveActivity(any(), eq(PackageManager.MATCH_DEFAULT_ONLY)),
    ).thenReturn(if (browserAvailable) ResolveInfo() else null)
    return packageManager
  }

  private fun contextWith(packageManager: PackageManager): Context {
    val context = mock<Context>()
    whenever(context.packageManager).thenReturn(packageManager)
    return context
  }

  @Test
  fun isSpotifyInstalled_returnsTrueWhenPackageExists() {
    val packageManager = packageManagerWith(spotifyInstalled = true, browserAvailable = false)
    assertTrue(SpotifyAuthAvailability.isSpotifyInstalled(packageManager))
  }

  @Test
  fun isSpotifyInstalled_returnsFalseWhenPackageMissing() {
    val packageManager = packageManagerWith(spotifyInstalled = false, browserAvailable = true)
    assertFalse(SpotifyAuthAvailability.isSpotifyInstalled(packageManager))
  }

  @Test
  fun canOpenSpotifyAuthInBrowser_returnsTrueWhenHandlerExists() {
    val packageManager = packageManagerWith(spotifyInstalled = false, browserAvailable = true)
    assertTrue(SpotifyAuthAvailability.canOpenSpotifyAuthInBrowser(packageManager))
  }

  @Test
  fun canOpenSpotifyAuthInBrowser_returnsFalseWhenNoHandlerExists() {
    val packageManager = packageManagerWith(spotifyInstalled = false, browserAvailable = false)
    assertFalse(SpotifyAuthAvailability.canOpenSpotifyAuthInBrowser(packageManager))
  }

  @Test
  fun isAuthAvailable_trueWhenOnlySpotifyInstalled() {
    val context = contextWith(packageManagerWith(spotifyInstalled = true, browserAvailable = false))
    assertTrue(SpotifyAuthAvailability.isAuthAvailable(context))
  }

  @Test
  fun isAuthAvailable_trueWhenOnlyBrowserAvailable() {
    val context = contextWith(packageManagerWith(spotifyInstalled = false, browserAvailable = true))
    assertTrue(SpotifyAuthAvailability.isAuthAvailable(context))
  }

  @Test
  fun isAuthAvailable_falseWhenNeitherAvailable() {
    val context = contextWith(packageManagerWith(spotifyInstalled = false, browserAvailable = false))
    assertFalse(SpotifyAuthAvailability.isAuthAvailable(context))
  }

  @Test
  fun ensureAuthAvailable_doesNotThrowWhenSpotifyInstalled() {
    val context = contextWith(packageManagerWith(spotifyInstalled = true, browserAvailable = false))
    SpotifyAuthAvailability.ensureAuthAvailable(context)
  }

  @Test
  fun ensureAuthAvailable_doesNotThrowWhenBrowserAvailable() {
    val context = contextWith(packageManagerWith(spotifyInstalled = false, browserAvailable = true))
    SpotifyAuthAvailability.ensureAuthAvailable(context)
  }

  @Test
  fun ensureAuthAvailable_throwsSpotifyNotInstalledWhenNeitherAvailable() {
    val context = contextWith(packageManagerWith(spotifyInstalled = false, browserAvailable = false))
    val exception = assertThrows(SpotifyNotInstalledException::class.java) {
      SpotifyAuthAvailability.ensureAuthAvailable(context)
    }
    assertEquals("SPOTIFY_NOT_INSTALLED", exception.code)
  }

  @Test
  fun mergedManifest_allowsBrowserDetectionOnAndroid11Plus() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    shadowOf(context.packageManager).addResolveInfoForIntent(
      browserIntent(),
      ResolveInfo().apply {
        activityInfo = ActivityInfo().apply {
          packageName = "com.android.chrome"
          name = "com.android.chrome.Main"
        }
      },
    )

    assertTrue(SpotifyAuthAvailability.canOpenSpotifyAuthInBrowser(context.packageManager))
  }
}
