import Constants from "expo-constants";

import type { SpotifyScope } from "expo-spotify-sdk";

const DEV_HOST = Constants.expoConfig?.hostUri ?? "127.0.0.1:8081";

export const TOKEN_SWAP_URL = `http://${DEV_HOST}/swap`;
export const TOKEN_REFRESH_URL = `http://${DEV_HOST}/refresh`;
export const USE_TOKEN_SWAP = false;
export const STORED_SESSION_KEY = "expo-spotify-example:session";

export const SCOPES: SpotifyScope[] = [
  "app-remote-control",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
  "streaming",
];
