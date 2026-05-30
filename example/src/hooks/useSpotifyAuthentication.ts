import { Auth } from "expo-spotify-sdk";

export function useSpotifyAuthentication() {
  return {
    isAvailable: Auth.isAvailable,
    authenticate: Auth.authenticate,
    refresh: Auth.refresh,
  };
}
