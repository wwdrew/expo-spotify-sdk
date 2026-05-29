import type { ExpoConfig } from "expo/config";
import withSpotifySdk from "../plugin/index.js";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  plugins: [
    withSpotifySdk({
      host: "authenticate",
      scheme: "expo-spotify-sdk-example",
      clientID: "your-client-id",
      redirectPathPattern: ".*",
    }),
    "expo-router",
  ],
});
