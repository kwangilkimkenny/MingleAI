import { describe, it, expect } from "vitest";
import { colors } from "../theme";

// WCAG relative luminance + contrast (순수 계산).
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("line-art token invariants", () => {
  it("accentStrong carries white text at AA (>=4.5)", () => {
    expect(contrast(colors.accentStrong, colors.onAccent)).toBeGreaterThanOrEqual(4.5);
  });
  it("grayMid is AA on both paper and card (>=4.5)", () => {
    expect(contrast(colors.grayMid, colors.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.grayMid, colors.card)).toBeGreaterThanOrEqual(4.5);
  });
  it("ink is strong on paper (>=12)", () => {
    expect(contrast(colors.ink, colors.paper)).toBeGreaterThanOrEqual(12);
  });
  it("danger hue is separated from accent (not the same red)", () => {
    expect(colors.danger).not.toBe(colors.accent);
    expect(colors.danger).not.toBe(colors.accentStrong);
  });
});
