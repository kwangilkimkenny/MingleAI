import { describe, it, expect } from "vitest";
import { nextGate, REQUIRED_CONSENTS, type AccountStatus, type PermissionState } from "./gate.js";

const allConsents = { terms: true, privacy: true, age19: false }; // age19 is legacy — never required
const bothPerms: PermissionState = { camera: true, microphone: true };

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
    expect(nextGate(status(), bothPerms)).toBe("ready");
  });

  it("requires identity verification before anything else (identity provides verified age)", () => {
    expect(
      nextGate(
        status({
          phoneVerifiedAt: null,
          consents: { terms: false, privacy: false, age19: false },
          hasProfile: false,
        }),
        { camera: false, microphone: false },
      ),
    ).toBe("identity");
  });

  it("requires consent after identity", () => {
    expect(
      nextGate(status({ consents: { terms: true, privacy: false, age19: false } }), bothPerms),
    ).toBe("consent");
  });

  it("blocks on missing camera OR microphone permission (hard gate) after consent", () => {
    expect(nextGate(status(), { camera: false, microphone: true })).toBe("permissions");
    expect(nextGate(status(), { camera: true, microphone: false })).toBe("permissions");
  });

  it("requires a profile last", () => {
    expect(nextGate(status({ hasProfile: false }), bothPerms)).toBe("profile");
  });

  it("never requires the legacy age19 consent scope", () => {
    expect(
      nextGate(status({ consents: { terms: true, privacy: true, age19: false } }), bothPerms),
    ).toBe("ready");
  });

  it("REQUIRED_CONSENTS covers terms and privacy only", () => {
    expect([...REQUIRED_CONSENTS].sort()).toEqual(["privacy", "terms"]);
  });
});
