import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

function authenticate(): string {
  return ExpoSpotifySDKModule.authenticate();
}

const Authenticate = {
  authenticate,
};

export { isAvailable, Authenticate };
