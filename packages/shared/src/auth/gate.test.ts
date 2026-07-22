import { describe, it, expect } from "vitest";
import { nextGate, REQUIRED_CONSENTS, type AccountStatus, type PermissionState } from "./gate.js";

const allConsents = { terms: true, privacy: true, age19: true };
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

  it("requires consent before anything else", () => {
    expect(nextGate(status({ consents: { terms: true, privacy: false, age19: true } }), bothPerms)).toBe(
      "consent",
    );
  });

  it("blocks on missing camera OR microphone permission (hard gate)", () => {
    expect(nextGate(status(), { camera: false, microphone: true })).toBe("permissions");
    expect(nextGate(status(), { camera: true, microphone: false })).toBe("permissions");
  });

  it("requires identity verification after permissions", () => {
    expect(nextGate(status({ phoneVerifiedAt: null }), bothPerms)).toBe("identity");
  });

  it("requires a profile last", () => {
    expect(nextGate(status({ hasProfile: false }), bothPerms)).toBe("profile");
  });

  it("enforces the order: consent outranks permissions outranks identity outranks profile", () => {
    const nothing = status({
      consents: { terms: false, privacy: false, age19: false },
      phoneVerifiedAt: null,
      hasProfile: false,
    });
    expect(nextGate(nothing, { camera: false, microphone: false })).toBe("consent");
  });

  it("REQUIRED_CONSENTS covers terms, privacy, and age19", () => {
    expect([...REQUIRED_CONSENTS].sort()).toEqual(["age19", "privacy", "terms"]);
  });
});
