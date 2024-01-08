import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expirationDate: number;
  isExpired: boolean;
}

function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

function authenticateAsync(scopes: string[]): Promise<SpotifySession> {
  return ExpoSpotifySDKModule.authenticate(scopes);
}

const Authenticate = {
  authenticateAsync,
};

export { isAvailable, Authenticate };
