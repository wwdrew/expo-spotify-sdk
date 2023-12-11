import ExpoModulesCore
import SpotifyiOS

public class ExpoSpotifySDKModule: Module {

  public func definition() -> ModuleDefinition {
    Name("ExpoSpotifySDK")

    // Sets constant properties on the module. Can take a dictionary or a closure that returns a dictionary.
    Constants([
      "PI": Double.pi
    ])

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Defines a JavaScript synchronous function that runs the native code on the JavaScript thread.
    Function("hello") {
      return "Hello world! 👋"
    }

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { (value: String) in
      // Send an event to JavaScript.
      self.sendEvent("onChange", [
        "value": value
      ])
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of the
    // view definition: Prop, Events.
    View(ExpoSpotifySDKView.self) {
      // Defines a setter for the `name` prop.
      Prop("name") { (view: ExpoSpotifySDKView, prop: String) in
        print(prop)
      }
    }
  }
}
