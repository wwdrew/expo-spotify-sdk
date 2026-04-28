import {
  authenticateAsync,
  isAvailable,
  refreshSessionAsync,
} from "expo-spotify-sdk";

export function useSpotifyAuthentication() {
  return {
    isAvailable,
    authenticateAsync,
    refreshSessionAsync,
  };
}
