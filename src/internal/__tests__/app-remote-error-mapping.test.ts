import fixture from "../app-remote-error-mapping.fixture.json";
import type { ContentErrorCode } from "../../content/error";
import type { ImagesErrorCode } from "../../images/error";
import type { PlayerErrorCode } from "../../player/error";
import type { UserErrorCode } from "../../user/error";

const PLAYER_CODES: readonly PlayerErrorCode[] = [
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "PREMIUM_REQUIRED",
  "INVALID_URI",
  "INVALID_PARAMETER",
  "OPERATION_NOT_ALLOWED",
  "UNKNOWN",
];

const USER_CODES: readonly UserErrorCode[] = [
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "INVALID_URI",
  "OPERATION_NOT_ALLOWED",
  "UNKNOWN",
];

const CONTENT_CODES: readonly ContentErrorCode[] = [
  "NOT_CONNECTED",
  "CONNECTION_LOST",
  "CONTENT_API_UNAVAILABLE",
  "UNKNOWN",
];

const IMAGE_CODES: readonly ImagesErrorCode[] = [
  "NOT_CONNECTED",
  "INVALID_URI",
  "IMAGE_LOAD_FAILED",
  "UNKNOWN",
];

const TS_CODES = {
  Player: PLAYER_CODES,
  User: USER_CODES,
  Content: CONTENT_CODES,
  Images: IMAGE_CODES,
} as const;

type FixtureNamespace = keyof typeof fixture.namespaces;
type FixtureRule = (typeof fixture.namespaces)[FixtureNamespace]["rules"][number];

describe("app-remote-error-mapping fixture", () => {
  it("documents all four App Remote namespaces", () => {
    expect(Object.keys(fixture.namespaces).sort()).toEqual([
      "Content",
      "Images",
      "Player",
      "User",
    ]);
  });

  it.each(Object.entries(TS_CODES))(
    "%s fixture codes match TypeScript error unions",
    (namespace, codes) => {
      const fixtureCodes = fixture.namespaces[namespace as FixtureNamespace].codes;
      expect(new Set(fixtureCodes)).toEqual(new Set(codes));
    },
  );

  it.each(Object.entries(fixture.namespaces))(
    "%s rules reference documented codes only",
    (namespace, config) => {
      const allowed = new Set(config.codes);
      for (const rule of config.rules) {
        expect(allowed.has(rule.code)).toBe(true);
      }
    },
  );

  it.each(Object.entries(fixture.namespaces))(
    "%s has an UNKNOWN fallback rule",
    (_namespace, config) => {
      expect(config.rules.some((rule) => rule.code === "UNKNOWN")).toBe(true);
    },
  );

  it.each(
    Object.entries(fixture.namespaces).flatMap(([namespace, config]) =>
      config.rules.map((rule) => [namespace, rule] as const),
    ),
  )("%s rule %s defines ios and android signals", (_namespace, rule: FixtureRule) => {
    expect(rule.ios).toEqual(
      expect.objectContaining({
        typed: expect.any(Array),
        messageContains: expect.any(Array),
      }),
    );
    expect(rule.android).toEqual(
      expect.objectContaining({
        typed: expect.any(Array),
        messageContains: expect.any(Array),
      }),
    );
  });
});
