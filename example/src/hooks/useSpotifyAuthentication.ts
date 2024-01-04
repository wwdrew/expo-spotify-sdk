import { isAvailable, Authenticate } from "expo-spotify-sdk";

export function useSpotifyAuthentication() {
  function authenticate() {
    if (!isAvailable()) {
      return "Unable to do this";
    }

    return Authenticate.authenticate();
  }

  return {
    isAvailable,
    authenticate,
  };
}
