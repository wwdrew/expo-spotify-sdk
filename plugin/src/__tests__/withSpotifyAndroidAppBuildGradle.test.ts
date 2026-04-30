/**
 * Tests for the Android build.gradle config plugin modifier.
 *
 * `withAppBuildGradle` is mocked to synchronously invoke the inner callback
 * so we can exercise the transformation logic without the full Expo prebuild
 * machinery.
 */

import { withAppBuildGradle } from "@expo/config-plugins";
import { withSpotifyAndroidAppBuildGradle } from "../android/withSpotifyAndroidAppBuildGradle";

// ─── Mock @expo/config-plugins ────────────────────────────────────────────────

jest.mock("@expo/config-plugins", () => ({
  withAppBuildGradle: jest.fn(),
}));

const mockedWithAppBuildGradle = jest.mocked(withAppBuildGradle);

// ─── Helpers ─────────────────────────────────────────────────────────────────

type GradleContents = string;

/** Wire the mock to call the callback with the supplied gradle contents. */
function setGradleContents(contents: GradleContents) {
  mockedWithAppBuildGradle.mockImplementation((config, fn) =>
    (fn as Function)({
      ...config,
      modResults: { language: "groovy" as const, contents },
    }),
  );
}

/** Call the plugin and return the resulting gradle string. */
function applyPlugin(
  contents: GradleContents,
  overrides: Partial<{
    clientID: string;
    host: string;
    scheme: string;
    redirectPathPattern: string;
  }> = {},
): string {
  setGradleContents(contents);
  const spotifyConfig = {
    clientID: "test-client-id",
    host: "authenticate",
    scheme: "myapp",
    ...overrides,
  };
  const result = withSpotifyAndroidAppBuildGradle(
    { name: "test", slug: "test" } as any,
    spotifyConfig,
  ) as any;
  return result.modResults.contents as string;
}

// ─── Sample gradle content ────────────────────────────────────────────────────

const GRADLE_WITH_DEFAULT_CONFIG = `
android {
    defaultConfig {
        applicationId "com.example.app"
        minSdkVersion 24
        targetSdkVersion 35
        versionCode 1
        versionName "1.0"
    }
}
`.trim();

const GRADLE_WITHOUT_DEFAULT_CONFIG = `
android {
}
`.trim();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("withSpotifyAndroidAppBuildGradle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("placeholder injection", () => {
    it("injects spotifyClientId into defaultConfig", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG, {
        clientID: "abc123",
      });
      expect(result).toContain('spotifyClientId: "abc123"');
    });

    it("injects spotifyRedirectUri as scheme://host", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG, {
        scheme: "myapp",
        host: "authenticate",
      });
      expect(result).toContain('spotifyRedirectUri: "myapp://authenticate"');
    });

    it("injects redirectSchemeName", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG, {
        scheme: "coolapp",
      });
      expect(result).toContain('redirectSchemeName: "coolapp"');
    });

    it("injects redirectHostName", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG, {
        host: "callback",
      });
      expect(result).toContain('redirectHostName: "callback"');
    });

    it("uses the default redirectPathPattern .*", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG);
      expect(result).toContain('redirectPathPattern: ".*"');
    });

    it("uses a custom redirectPathPattern when provided", () => {
      const result = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG, {
        redirectPathPattern: "/auth/.*",
      });
      expect(result).toContain('redirectPathPattern: "/auth/.*"');
    });

    it("appends an android block when defaultConfig is absent", () => {
      const result = applyPlugin(GRADLE_WITHOUT_DEFAULT_CONFIG);
      expect(result).toContain("manifestPlaceholders");
      expect(result).toContain('spotifyClientId: "test-client-id"');
    });
  });

  describe("idempotency", () => {
    it("does not inject placeholders a second time if already present", () => {
      // First application injects the block
      const firstResult = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG);
      expect(firstResult).toContain("spotifyClientId");

      // Second application should be a no-op because SENTINEL_KEY is present
      const secondResult = applyPlugin(firstResult);
      const occurrences = (
        secondResult.match(/spotifyClientId/g) ?? []
      ).length;
      expect(occurrences).toBe(1);
    });

    it("returns the config unmodified on the second run", () => {
      const first = applyPlugin(GRADLE_WITH_DEFAULT_CONFIG);
      const second = applyPlugin(first);
      expect(second).toBe(first);
    });
  });

  describe("withAppBuildGradle integration", () => {
    it("calls withAppBuildGradle exactly once", () => {
      applyPlugin(GRADLE_WITH_DEFAULT_CONFIG);
      expect(mockedWithAppBuildGradle).toHaveBeenCalledTimes(1);
    });

    it("passes the original ExpoConfig as the first argument", () => {
      const config = { name: "myapp", slug: "myapp" } as any;
      setGradleContents(GRADLE_WITH_DEFAULT_CONFIG);
      withSpotifyAndroidAppBuildGradle(config, {
        clientID: "x",
        host: "h",
        scheme: "s",
      });
      expect(mockedWithAppBuildGradle).toHaveBeenCalledWith(
        config,
        expect.any(Function),
      );
    });
  });
});
