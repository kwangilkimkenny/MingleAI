import { describe, it, expect } from "vitest";
import { lookFor, HAIRS, OUTFITS, EYES_SET, MOUTHS } from "../character-look";

describe("lookFor", () => {
  it("결정적 — 같은 key는 같은 look", () => {
    expect(lookFor("profile-abc")).toEqual(lookFor("profile-abc"));
  });

  it("모든 파츠가 유효 집합 안이다", () => {
    const l = lookFor("someone");
    expect(HAIRS).toContain(l.hair);
    expect(OUTFITS).toContain(l.outfit);
    expect(EYES_SET).toContain(l.eyes);
    expect(MOUTHS).toContain(l.mouth);
    expect(["cheek", "string"]).toContain(l.accent);
    expect(l.seed).toBeGreaterThan(0);
  });

  it("서로 다른 key는 대체로 다른 조합(분포)", () => {
    const keys = Array.from({ length: 40 }, (_, i) => `k${i}`);
    const combos = new Set(keys.map((k) => JSON.stringify(lookFor(k))));
    // 40개 중 최소 8종 이상 서로 다른 조합이면 편향 아님
    expect(combos.size).toBeGreaterThanOrEqual(8);
  });

  it("빈 문자열도 유효 look을 준다", () => {
    const l = lookFor("");
    expect(HAIRS).toContain(l.hair);
  });
});
