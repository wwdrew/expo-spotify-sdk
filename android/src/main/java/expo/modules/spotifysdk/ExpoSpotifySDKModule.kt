package expo.modules.spotifysdk

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSpotifySDKModule : Module() {

  override fun definition() = ModuleDefinition {

    Name("ExpoSpotifySDK")

    Function("authenticatePrompt") {
      "authenticate prompt"
    }
  }
}
