import { describe, expect, it } from "vitest";
import { hatchSegments, mulberry, wobbleRect } from "../doodle-path";

const RADIUS = {
  borderTopLeftRadius: 18,
  borderTopRightRadius: 10,
  borderBottomRightRadius: 20,
  borderBottomLeftRadius: 12,
};

describe("mulberry", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry(7);
    const b = mulberry(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("stays in [0, 1)", () => {
    const r = mulberry(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("wobbleRect", () => {
  it("returns a closed path that starts with M", () => {
    const d = wobbleRect(200, 100, RADIUS, 1);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trimEnd().endsWith("Z")).toBe(true);
  });
  it("is deterministic per seed and differs across seeds", () => {
    expect(wobbleRect(200, 100, RADIUS, 5)).toEqual(wobbleRect(200, 100, RADIUS, 5));
    expect(wobbleRect(200, 100, RADIUS, 5)).not.toEqual(wobbleRect(200, 100, RADIUS, 6));
  });
  it("keeps every coordinate within amp of the box", () => {
    const d = wobbleRect(200, 100, RADIUS, 2, { amp: 2 });
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(-2.5);
      expect(nums[i]).toBeLessThanOrEqual(202.5);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(-2.5);
      expect(nums[i + 1]).toBeLessThanOrEqual(102.5);
    }
  });
  it("handles boxes smaller than the radii without NaN", () => {
    const d = wobbleRect(24, 20, RADIUS, 3);
    expect(d).not.toMatch(/NaN/);
  });
  it("clamps radii per the CSS overlap rule (no reversed edges)", () => {
    const cases = [
      {
        w: 60,
        h: 10,
        r: {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 100,
          borderBottomRightRadius: 150,
          borderBottomLeftRadius: 1,
        },
      },
      {
        w: 10,
        h: 1000,
        r: {
          borderTopLeftRadius: 1,
          borderTopRightRadius: 200,
          borderBottomRightRadius: 1,
          borderBottomLeftRadius: 1,
        },
      },
    ];
    for (const { w, h, r } of cases) {
      const d = wobbleRect(w, h, r, 1);
      expect(d).not.toMatch(/NaN/);
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < nums.length; i += 2) {
        expect(nums[i]).toBeGreaterThanOrEqual(-2.1);
        expect(nums[i]).toBeLessThanOrEqual(w + 2.1);
        expect(nums[i + 1]).toBeGreaterThanOrEqual(-2.1);
        expect(nums[i + 1]).toBeLessThanOrEqual(h + 2.1);
      }
    }
  });
  it("returns empty path for zero or negative dimensions", () => {
    expect(wobbleRect(0, 10, RADIUS, 1)).toBe("M0 0 Z");
    expect(wobbleRect(10, 0, RADIUS, 1)).toBe("M0 0 Z");
    expect(wobbleRect(-5, 20, RADIUS, 1)).toBe("M0 0 Z");
  });
});

describe("hatchSegments", () => {
  it("covers the box with 45deg segments inside bounds", () => {
    const segs = hatchSegments(60, 16);
    expect(segs.length).toBeGreaterThan(5);
    for (const s of segs) {
      for (const v of [s.x1, s.x2]) expect(v).toBeGreaterThanOrEqual(-0.01);
      for (const v of [s.x1, s.x2]) expect(v).toBeLessThanOrEqual(60.01);
      for (const v of [s.y1, s.y2]) expect(v).toBeGreaterThanOrEqual(-0.01);
      for (const v of [s.y1, s.y2]) expect(v).toBeLessThanOrEqual(16.01);
    }
  });
  it("returns no segments for zero width", () => {
    expect(hatchSegments(0, 16)).toEqual([]);
  });
  it("returns no segments for zero or negative spacing", () => {
    expect(hatchSegments(10, 10, 0)).toEqual([]);
    expect(hatchSegments(10, 10, -1)).toEqual([]);
  });
});
