import { describe, it, expect } from "vitest";
import { colors, dark } from "../theme";

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

/** rgba(...) 반투명 색을 배경 위에 합성 — 다크 hairline/뮤트 텍스트의 실제 색. */
function flatten(rgba: string, bg: string): string {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/.exec(rgba);
  if (!m) return rgba;
  const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  const n = parseInt(bg.slice(1), 16);
  const back = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = [r, g, b].map((c, i) => Math.round(c * a + back[i] * (1 - a)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

describe("dark token invariants", () => {
  it("body and heading text clear AA on every dark surface", () => {
    for (const bg of [dark.bg, dark.surface, dark.surfaceHi]) {
      expect(contrast(dark.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark.heading, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("muted text stays AA once flattened onto each surface", () => {
    for (const bg of [dark.bg, dark.surface, dark.surfaceHi]) {
      expect(contrast(flatten(dark.textMuted, bg), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("blush label and danger stay AA on dark", () => {
    expect(contrast(dark.label, dark.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.danger, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("the cream pill carries its ink label at AA", () => {
    expect(contrast(dark.pill, dark.onPill)).toBeGreaterThanOrEqual(4.5);
  });

  it("the reservation-style badge (accent fill, bg text) is readable", () => {
    expect(contrast(dark.accent, dark.bg)).toBeGreaterThanOrEqual(4.5);
  });

  // 구조 대비 — 2026-08-06 감사에서 카드가 배경에 묻혀 있었다. 회귀 방지 하한.
  it("cards and selected rows separate from what is behind them", () => {
    expect(contrast(dark.surface, dark.bg)).toBeGreaterThanOrEqual(1.2);
    expect(contrast(dark.surfaceHi, dark.surface)).toBeGreaterThanOrEqual(1.2);
  });

  it("hairlines are visible, and borderStrong meets the 3:1 non-text bar", () => {
    expect(contrast(flatten(dark.border, dark.surface), dark.surface)).toBeGreaterThanOrEqual(2);
    expect(contrast(flatten(dark.line, dark.surface), dark.surface)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(flatten(dark.borderStrong, dark.bg), dark.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("확장 팔레트 불변식 (2026-08-07)", () => {
  it("표면이 아래에서 위로 단계적으로 밝아진다", () => {
    const steps = [dark.bg, dark.surface, dark.surfaceHi, dark.surfaceTop];
    for (let i = 1; i < steps.length; i++) {
      // 각 단계는 바로 아래 단계와 구분돼야 한다(층이 읽히는 최소선).
      expect(contrast(steps[i], steps[i - 1])).toBeGreaterThanOrEqual(1.1);
    }
    // 가장 높은 표면에서도 본문이 AA를 지킨다.
    expect(contrast(dark.text, dark.surfaceTop)).toBeGreaterThanOrEqual(4.5);
  });

  it("강조 램프가 밝기 순서를 지킨다", () => {
    expect(contrast(dark.accentBright, dark.bg)).toBeGreaterThan(contrast(dark.accent, dark.bg));
    expect(contrast(dark.accent, dark.bg)).toBeGreaterThan(contrast(dark.accentDim, dark.bg));
  });

  it("2차 강조(골드·세이지)가 다크에서 AA를 넘는다", () => {
    for (const c of [dark.gold, dark.goldBright, dark.success, dark.successBright]) {
      expect(contrast(c, dark.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c, dark.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("색 채움 위에 얹는 잉크 글씨가 AA를 넘는다", () => {
    expect(contrast(dark.accent, dark.onAccent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.gold, dark.onGold)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.success, dark.onSuccess)).toBeGreaterThanOrEqual(4.5);
  });

  it("의미색이 서로 구분된다(같은 색을 두 뜻으로 쓰지 않는다)", () => {
    const semantic = [dark.accent, dark.gold, dark.success, dark.danger];
    expect(new Set(semantic).size).toBe(semantic.length);
  });

  it("반투명 채움은 배경을 덮지 않을 만큼만 얹는다", () => {
    for (const fill of [dark.accentFill, dark.goldFill, dark.successFill, dark.dangerFill]) {
      const flat = flatten(fill, dark.surface);
      // 살짝 뜨되(1.05+) 카드처럼 무거워지지는 않게(1.6 미만).
      expect(contrast(flat, dark.surface)).toBeGreaterThanOrEqual(1.05);
      expect(contrast(flat, dark.surface)).toBeLessThan(1.6);
    }
  });
});
