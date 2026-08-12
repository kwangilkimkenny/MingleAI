import { describe, expect, it } from "vitest";

import { resolveIdentityVerificationMode } from "../identity-verification-mode";

describe("identity verification release guard regression", () => {
  it("allows the developer form only in a development bundle", () => {
    expect(resolveIdentityVerificationMode("dev", true)).toBe("dev");
  });

  it("rejects a dev-mode server response in a release bundle", () => {
    expect(resolveIdentityVerificationMode("dev", false)).toBe("unavailable");
  });

  // 실 공급자(NICE)는 계약 후 갈래가 늘어난다. 그전까지 릴리스 번들엔 인증 수단이 없다 —
  // 개발용 입력폼이 운영에 새어 나가는 것보다 "사용 불가"가 안전하다(2026-08-12).
});
