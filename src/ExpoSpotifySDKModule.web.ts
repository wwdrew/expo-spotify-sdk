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
  addListener(): { remove(): void } {
    return { remove() {} };
  },
  removeListeners(): void {
    /* no-op */
  },
};
