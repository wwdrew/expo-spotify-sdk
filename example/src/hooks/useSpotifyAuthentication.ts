import { isAvailable, Authenticate } from "expo-spotify-sdk";

export function useSpotifyAuthentication() {
  return {
    isAvailable,
    authenticateAsync: Authenticate.authenticateAsync,
  };
}
