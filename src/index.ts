import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

const Authenticate = {
  authenticate: ExpoSpotifySDKModule.authenticate,
};

export { isAvailable, Authenticate };
