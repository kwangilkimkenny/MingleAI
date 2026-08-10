import { describe, expect, it } from "vitest";

import { resolveIdentityVerificationMode } from "../identity-verification-mode";

describe("identity verification release guard regression", () => {
  it("allows the developer form only in a development bundle", () => {
    expect(resolveIdentityVerificationMode("dev", true)).toBe("dev");
  });

  it("rejects a dev-mode server response in a release bundle", () => {
    expect(resolveIdentityVerificationMode("dev", false)).toBe("unavailable");
  });

  it("keeps redirect mode unavailable until the provider flow is implemented", () => {
    expect(resolveIdentityVerificationMode("redirect", true)).toBe("unavailable");
    expect(resolveIdentityVerificationMode("redirect", false)).toBe("unavailable");
  });
});
