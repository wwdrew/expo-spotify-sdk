package expo.modules.spotifysdk

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSpotifySDKModule : Module() {

  override fun definition() = ModuleDefinition {

    Name("ExpoSpotifySDK")

    Function("isAvailable") {
      return@Function false
    }

    AsyncFunction("authenticateAsync") { config: String, promise: Promise ->
      promise.resolve(config)
    }
  }
}
