/**
 * Tests for the iOS URL scheme config plugin modifier.
 */

import { withInfoPlist } from "@expo/config-plugins";
import { withSpotifyURLScheme } from "../ios/withSpotifyURLScheme";

jest.mock("@expo/config-plugins", () => ({
  withInfoPlist: jest.fn(),
}));

const mockedWithInfoPlist = jest.mocked(withInfoPlist);

// ─── Helper ───────────────────────────────────────────────────────────────────

type InfoPlist = Record<string, unknown>;

function applyPlugin(
  plist: InfoPlist,
  scheme = "myapp",
  bundleId?: string,
): InfoPlist {
  mockedWithInfoPlist.mockImplementation((config, fn) =>
    (fn as Function)({
      ...config,
      ios: { bundleIdentifier: bundleId },
      modResults: { ...plist },
    }),
  );
  const result = withSpotifyURLScheme(
    { name: "test", slug: "test" } as any,
    { clientID: "x", host: "h", scheme },
  ) as any;
  return result.modResults as InfoPlist;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("withSpotifyURLScheme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds a new URL type when CFBundleURLTypes is absent", () => {
    const result = applyPlugin({}, "myapp", "com.example.app");
    const urlTypes = result.CFBundleURLTypes as Array<{
      CFBundleURLSchemes: string[];
      CFBundleURLName: string;
    }>;
    expect(urlTypes).toHaveLength(1);
    expect(urlTypes[0].CFBundleURLSchemes).toContain("myapp");
    expect(urlTypes[0].CFBundleURLName).toBe("com.example.app");
  });

  it("appends a new URL type when other schemes already exist", () => {
    const existing = {
      CFBundleURLTypes: [
        { CFBundleURLName: "com.example.app", CFBundleURLSchemes: ["other"] },
      ],
    };
    const result = applyPlugin(existing, "myapp");
    const urlTypes = result.CFBundleURLTypes as Array<{
      CFBundleURLSchemes: string[];
    }>;
    expect(urlTypes).toHaveLength(2);
    const schemes = urlTypes.flatMap((t) => t.CFBundleURLSchemes);
    expect(schemes).toContain("other");
    expect(schemes).toContain("myapp");
  });

  describe("idempotency", () => {
    it("does not add a duplicate scheme entry when already declared", () => {
      const existingWithScheme = {
        CFBundleURLTypes: [
          {
            CFBundleURLName: "com.example.app",
            CFBundleURLSchemes: ["myapp"],
          },
        ],
      };
      const result = applyPlugin(existingWithScheme, "myapp");
      const urlTypes = result.CFBundleURLTypes as Array<{
        CFBundleURLSchemes: string[];
      }>;
      expect(urlTypes).toHaveLength(1);
      const allSchemes = urlTypes.flatMap((t) => t.CFBundleURLSchemes);
      expect(allSchemes.filter((s) => s === "myapp")).toHaveLength(1);
    });

    it("returns plist unchanged when scheme already declared", () => {
      const existingWithScheme = {
        CFBundleURLTypes: [
          { CFBundleURLName: "com.example", CFBundleURLSchemes: ["myapp"] },
        ],
        OtherKey: "value",
      };
      const result = applyPlugin(existingWithScheme, "myapp");
      // Exactly one entry, no new entry added
      const urlTypes = result.CFBundleURLTypes as Array<unknown>;
      expect(urlTypes).toHaveLength(1);
    });
  });

  it("uses empty string as CFBundleURLName when bundleIdentifier is absent", () => {
    const result = applyPlugin({}, "myapp", undefined);
    const urlTypes = result.CFBundleURLTypes as Array<{
      CFBundleURLName: string;
    }>;
    expect(urlTypes[0].CFBundleURLName).toBe("");
  });
});
