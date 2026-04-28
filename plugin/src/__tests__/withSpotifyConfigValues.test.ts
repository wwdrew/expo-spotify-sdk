/**
 * Tests for the iOS Info.plist `ExpoSpotifySDK` dictionary modifier.
 */

import { withInfoPlist } from "@expo/config-plugins";
import { withSpotifyConfigValues } from "../ios/withSpotifyConfigValues";

jest.mock("@expo/config-plugins", () => ({
  withInfoPlist: jest.fn(),
}));

const mockedWithInfoPlist = jest.mocked(withInfoPlist);

// ─── Helper ───────────────────────────────────────────────────────────────────

type InfoPlist = Record<string, unknown>;

function applyPlugin(
  plist: InfoPlist,
  overrides: Partial<{
    clientID: string;
    host: string;
    scheme: string;
    redirectPathPattern: string;
  }> = {},
): InfoPlist {
  mockedWithInfoPlist.mockImplementation((config, fn) =>
    (fn as Function)({ ...config, modResults: { ...plist } }),
  );
  const spotifyConfig = {
    clientID: "my-client-id",
    host: "authenticate",
    scheme: "myapp",
    ...overrides,
  };
  const result = withSpotifyConfigValues(
    { name: "test", slug: "test" } as any,
    spotifyConfig,
  ) as any;
  return result.modResults as InfoPlist;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("withSpotifyConfigValues", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes clientID, host and scheme to ExpoSpotifySDK dictionary", () => {
    const result = applyPlugin({});
    const sdk = result.ExpoSpotifySDK as Record<string, string>;
    expect(sdk.clientID).toBe("my-client-id");
    expect(sdk.host).toBe("authenticate");
    expect(sdk.scheme).toBe("myapp");
  });

  it("merges with an existing ExpoSpotifySDK dictionary without erasing existing keys", () => {
    const plist = { ExpoSpotifySDK: { customKey: "kept" } };
    const result = applyPlugin(plist, { clientID: "new-id" });
    const sdk = result.ExpoSpotifySDK as Record<string, string>;
    expect(sdk.customKey).toBe("kept");
    expect(sdk.clientID).toBe("new-id");
  });

  it("does not write redirectPathPattern (iOS-only keys are clientID, host, scheme)", () => {
    const result = applyPlugin({}, { redirectPathPattern: "/.*" });
    const sdk = result.ExpoSpotifySDK as Record<string, string>;
    expect(sdk.redirectPathPattern).toBeUndefined();
  });

  it("overwrites an existing clientID when a new one is provided", () => {
    const plist = { ExpoSpotifySDK: { clientID: "old-id" } };
    const result = applyPlugin(plist, { clientID: "fresh-id" });
    const sdk = result.ExpoSpotifySDK as Record<string, string>;
    expect(sdk.clientID).toBe("fresh-id");
  });

  it("creates ExpoSpotifySDK when plist is empty", () => {
    const result = applyPlugin({});
    expect(result.ExpoSpotifySDK).toBeDefined();
  });

  it("skips empty-string values", () => {
    const result = applyPlugin({}, { clientID: "" });
    const sdk = result.ExpoSpotifySDK as Record<string, string>;
    // empty string should not overwrite a previously set value
    expect(sdk.clientID).toBeUndefined();
  });
});
