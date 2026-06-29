import type { AuthErrorCode } from "../../auth/error";
import fixture from "../auth-error-mapping.fixture.json";

const AUTH_CODES: readonly AuthErrorCode[] = [
  "USER_CANCELLED",
  "AUTH_IN_PROGRESS",
  "INVALID_CONFIG",
  "NETWORK_ERROR",
  "TOKEN_SWAP_FAILED",
  "TOKEN_SWAP_PARSE_ERROR",
  "REFRESH_TOKEN_EXPIRED",
  "SPOTIFY_NOT_INSTALLED",
  "AUTH_ERROR",
  "UNKNOWN",
];

type FixtureRule = (typeof fixture.rules)[number];

describe("auth-error-mapping fixture", () => {
  it("documents the Auth namespace", () => {
    expect(fixture.namespace).toBe("Auth");
  });

  it("fixture codes match the TypeScript AuthErrorCode union", () => {
    expect(new Set(fixture.codes)).toEqual(new Set(AUTH_CODES));
  });

  it("every rule references a documented code", () => {
    const allowed = new Set(fixture.codes);
    for (const rule of fixture.rules) {
      expect(allowed.has(rule.code)).toBe(true);
    }
  });

  it("every documented code is covered by a rule or marked pass-through", () => {
    const ruleCodes = new Set(fixture.rules.map((rule) => rule.code));
    const passthrough = new Set(fixture.passthroughCodes);
    for (const code of fixture.codes) {
      expect(ruleCodes.has(code) || passthrough.has(code)).toBe(true);
    }
  });

  it("pass-through codes are documented codes not produced by any rule", () => {
    const allowed = new Set(fixture.codes);
    const ruleCodes = new Set(fixture.rules.map((rule) => rule.code));
    for (const code of fixture.passthroughCodes) {
      expect(allowed.has(code)).toBe(true);
      expect(ruleCodes.has(code)).toBe(false);
    }
  });

  it("has an UNKNOWN fallback rule", () => {
    expect(fixture.rules.some((rule) => rule.code === "UNKNOWN")).toBe(true);
  });

  it("classifier rules are listed in strict priority order", () => {
    const priorities = fixture.rules.map((rule) => rule.priority);
    const sorted = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sorted);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it("ranks typed/structural signals above best-effort text heuristics", () => {
    const lastTyped = Math.max(
      ...fixture.rules
        .filter((rule) => rule.tier === "typed")
        .map((rule) => rule.priority),
    );
    const firstText = Math.min(
      ...fixture.rules
        .filter((rule) => rule.tier === "text")
        .map((rule) => rule.priority),
    );
    expect(lastTyped).toBeLessThan(firstText);
  });

  it("the fallback rule is evaluated last", () => {
    const maxPriority = Math.max(...fixture.rules.map((rule) => rule.priority));
    const fallback = fixture.rules.find((rule) => rule.tier === "fallback");
    expect(fallback?.priority).toBe(maxPriority);
  });

  it.each(fixture.rules)(
    "rule %#($code) defines ios and android signals",
    (rule: FixtureRule) => {
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
    },
  );
});
