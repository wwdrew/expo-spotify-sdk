function unsupported(method: string): Error {
  return new Error(
    `[expo-spotify-sdk] ${method} is not supported on web. ` +
      "This library targets iOS and Android only.",
  );
}

export default {
  isAvailable(): boolean {
    return false;
  },
  authenticateAsync(): Promise<never> {
    return Promise.reject(unsupported("authenticateAsync"));
  },
  refreshSessionAsync(): Promise<never> {
    return Promise.reject(unsupported("refreshSessionAsync"));
  },
  appRemoteConnect(): Promise<never> {
    return Promise.reject(unsupported("appRemoteConnect"));
  },
  appRemoteDisconnect(): Promise<never> {
    return Promise.reject(unsupported("appRemoteDisconnect"));
  },
  appRemoteIsConnected(): boolean {
    return false;
  },
  appRemoteGetConnectionState(): Promise<"disconnected"> {
    return Promise.resolve("disconnected");
  },
  playerPlay(): Promise<never> {
    return Promise.reject(unsupported("playerPlay"));
  },
  playerPause(): Promise<never> {
    return Promise.reject(unsupported("playerPause"));
  },
  playerResume(): Promise<never> {
    return Promise.reject(unsupported("playerResume"));
  },
  playerSkipNext(): Promise<never> {
    return Promise.reject(unsupported("playerSkipNext"));
  },
  playerSkipPrevious(): Promise<never> {
    return Promise.reject(unsupported("playerSkipPrevious"));
  },
  playerSeekTo(): Promise<never> {
    return Promise.reject(unsupported("playerSeekTo"));
  },
  playerSetShuffle(): Promise<never> {
    return Promise.reject(unsupported("playerSetShuffle"));
  },
  playerSetRepeatMode(): Promise<never> {
    return Promise.reject(unsupported("playerSetRepeatMode"));
  },
  playerSetPodcastPlaybackSpeed(): Promise<never> {
    return Promise.reject(unsupported("playerSetPodcastPlaybackSpeed"));
  },
  playerQueue(): Promise<never> {
    return Promise.reject(unsupported("playerQueue"));
  },
  playerGetPlayerState(): Promise<never> {
    return Promise.reject(unsupported("playerGetPlayerState"));
  },
  playerGetCrossfadeState(): Promise<never> {
    return Promise.reject(unsupported("playerGetCrossfadeState"));
  },
  userGetCapabilities(): Promise<never> {
    return Promise.reject(unsupported("userGetCapabilities"));
  },
  userGetLibraryState(): Promise<never> {
    return Promise.reject(unsupported("userGetLibraryState"));
  },
  userAddToLibrary(): Promise<never> {
    return Promise.reject(unsupported("userAddToLibrary"));
  },
  userRemoveFromLibrary(): Promise<never> {
    return Promise.reject(unsupported("userRemoveFromLibrary"));
  },
  addListener(): { remove(): void } {
    return { remove() {} };
  },
  removeListeners(): void {
    /* no-op */
  },
};
