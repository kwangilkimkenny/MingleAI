import { describe, expect, it } from "vitest";
import { notificationRowAppearance } from "../notification-appearance";
import { dark } from "../theme";

// Regression: ISSUE-002 — read notification rows dimmed their text below a usable contrast
// Found by /qa on 2026-08-07
// Report: .gstack/qa-reports/release-readiness-qa-2026-08-07.md
describe("notification row appearance", () => {
  it("separates read notifications using the surface only, never whole-row opacity", () => {
    const read = notificationRowAppearance(true);

    expect(read).toEqual({ backgroundColor: dark.surface });
    expect(read).not.toHaveProperty("opacity");
  });

  it("keeps unread notifications on the raised surface", () => {
    expect(notificationRowAppearance(false)).toEqual({ backgroundColor: dark.surfaceHi });
  });
});
