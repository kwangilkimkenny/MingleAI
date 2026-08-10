import { describe, expect, it } from "vitest";

import { resolveIdentityVerificationMode } from "../identity-verification-mode";

describe("identity verification release guard regression", () => {
  it("allows the developer form only in a development bundle", () => {
    expect(resolveIdentityVerificationMode("dev", true)).toBe("dev");
  });

  it("rejects a dev-mode server response in a release bundle", () => {
    expect(resolveIdentityVerificationMode("dev", false)).toBe("unavailable");
  });

  it("opens configured PortOne verification in development and release builds", () => {
    expect(resolveIdentityVerificationMode("portone", true)).toBe("portone");
    expect(resolveIdentityVerificationMode("portone", false)).toBe("portone");
  });
});
