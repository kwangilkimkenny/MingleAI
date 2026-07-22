import { describe, expect, it } from "vitest";
import { isSpeedDateEligibleGender } from "../speed-date-eligibility";

// Regression: ISSUE-006 — unsupported genders learned about eligibility only after consent
// Found by /qa on 2026-07-22
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-22.md
describe("speed-date eligibility", () => {
  it.each([
    ["male", true],
    ["female", true],
    ["non_binary", false],
    ["prefer_not_to_say", false],
  ])("returns %s eligibility as %s", (gender, expected) => {
    expect(isSpeedDateEligibleGender(gender)).toBe(expected);
  });
});
