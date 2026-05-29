import withSpotifySdk from "../index";

describe("typed config plugin export", () => {
  it("returns a plugin tuple for app.config.ts", () => {
    const props = {
      clientID: "test-client-id",
      scheme: "myapp",
      host: "spotify-auth",
      redirectPathPattern: ".*",
    };

    expect(withSpotifySdk(props)).toEqual([
      "@wwdrew/expo-spotify-sdk",
      props,
    ]);
  });
});
