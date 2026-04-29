import { SpotifyError } from "./ExpoSpotifySDK.types";

function notImplementedReject(method: string): SpotifyError {
  return new SpotifyError(
    "INVALID_CONFIG",
    `expo-spotify-sdk: ${method} is not implemented on web yet (planned for v0.7.0).`,
  );
}

export default {
  isAvailable(): boolean {
    return false;
  },
  authenticateAsync(): Promise<never> {
    return Promise.reject(notImplementedReject("authenticateAsync"));
  },
  refreshSessionAsync(): Promise<never> {
    return Promise.reject(notImplementedReject("refreshSessionAsync"));
  },
  addListener(): { remove(): void } {
    return { remove() {} };
  },
  removeListeners(): void {
    /* no-op */
  },
};
