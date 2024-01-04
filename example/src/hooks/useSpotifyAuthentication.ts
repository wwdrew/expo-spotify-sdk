import { isAvailable, Authenticate } from "expo-spotify-sdk";

export function useSpotifyAuthentication() {
  function authenticate() {
    if (!isAvailable()) {
      console.log("Unable to do this ");
      return "Unable to do this";
    }

    return Authenticate.authenticate();
  }

  return {
    isAvailable,
    authenticate,
  };
}
