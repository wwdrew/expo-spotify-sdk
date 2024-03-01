package expo.modules.spotifysdk

import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSpotifySDKModule : Module() {

  private val context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {

    Name("ExpoSpotifySDK")

    Function("isAvailable") {
      val packageManager: PackageManager = context.packageManager
      val intent = packageManager.getLaunchIntentForPackage("com.spotify.music")
      return@Function intent != null
    }

    AsyncFunction("authenticateAsync") { config: String, promise: Promise ->
      promise.resolve(config)
    }
  }
}
