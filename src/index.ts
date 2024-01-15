import { SpotifyScope, SpotifySession } from "./ExpoSpotifySDK.types";
import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

function authenticateAsync(scopes: SpotifyScope[]): Promise<SpotifySession> {
  return ExpoSpotifySDKModule.authenticate(scopes);
}

const Authenticate = {
  authenticateAsync,
};

export { isAvailable, Authenticate };
