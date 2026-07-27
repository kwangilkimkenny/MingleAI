import { describe, it, expect } from "vitest";
import { nextGate, REQUIRED_CONSENTS, type AccountStatus } from "./gate.js";

const allConsents = { terms: true, privacy: true, age19: false }; // age19 is legacy — never required

function status(over: Partial<AccountStatus> = {}): AccountStatus {
  return {
    provider: "kakao",
    phoneVerifiedAt: "2026-07-22T00:00:00Z",
    consents: { ...allConsents },
    hasProfile: true,
    ...over,
  };
}

describe("nextGate", () => {
  it("returns ready when everything is satisfied", () => {
    expect(nextGate(status())).toBe("ready");
  });

  it("requires identity verification before anything else (identity provides verified age)", () => {
    expect(
      nextGate(
        status({
          phoneVerifiedAt: null,
          consents: { terms: false, privacy: false, age19: false },
          hasProfile: false,
        }),
      ),
    ).toBe("identity");
  });

  it("requires consent after identity", () => {
    expect(nextGate(status({ consents: { terms: true, privacy: false, age19: false } }))).toBe(
      "consent",
    );
  });

  it("requires a profile last", () => {
    expect(nextGate(status({ hasProfile: false }))).toBe("profile");
  });

  it("does not gate on camera/mic permission (session-entry concern, not onboarding)", () => {
    // nextGate takes no permission input at all — readiness is account state only.
    expect(nextGate(status())).toBe("ready");
  });

  it("never requires the legacy age19 consent scope", () => {
    expect(nextGate(status({ consents: { terms: true, privacy: true, age19: false } }))).toBe(
      "ready",
    );
  });

  it("REQUIRED_CONSENTS covers terms and privacy only", () => {
    expect([...REQUIRED_CONSENTS].sort()).toEqual(["privacy", "terms"]);
  });
});
