import ExpoModulesCore
import SpotifyiOS

public class ExpoSpotifySDKModule: Module {

  public func definition() -> ModuleDefinition {

    Name("ExpoSpotifySDK")

    Function("authenticatePrompt") {
      return "authenticate prompt"
    }
  }
}
