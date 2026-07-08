import { describe, it, expect } from "vitest";
import { REASON_LABELS, reasonLabel } from "../moderation";

const EXPECTED_REASONS = [
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
] as const;

describe("moderation reason labels", () => {
  it("has a non-empty label for every backend reason", () => {
    for (const r of EXPECTED_REASONS) {
      expect(REASON_LABELS[r]).toBeTruthy();
    }
  });

  it("exposes exactly the six backend reasons", () => {
    expect(Object.keys(REASON_LABELS).sort()).toEqual([...EXPECTED_REASONS].sort());
  });

  it("reasonLabel maps a reason to its label", () => {
    expect(reasonLabel("harassment")).toBe("괴롭힘 / 폭언");
    expect(reasonLabel("other")).toBe("기타");
  });
});
