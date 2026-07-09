import { describe, it, expect } from "vitest";
import {
  clampToRoom,
  stepToward,
  shouldEmit,
  spawnFor,
  initialOf,
  ROOM_MARGIN,
  EMIT_MIN_INTERVAL_MS,
} from "../party-space";

describe("clampToRoom", () => {
  it("clamps both axes into the margin-inset unit square", () => {
    expect(clampToRoom({ x: -1, y: 2 })).toEqual({
      x: ROOM_MARGIN,
      y: 1 - ROOM_MARGIN,
    });
    expect(clampToRoom({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("stepToward", () => {
  it("moves toward the target scaled by dt", () => {
    const next = stepToward({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 100); // 0.035 step
    expect(next.x).toBeCloseTo(0.035, 5);
    expect(next.y).toBeCloseTo(0.5, 5);
  });
  it("snaps onto the target when closer than one step", () => {
    expect(stepToward({ x: 0.999, y: 0.5 }, { x: 1, y: 0.5 }, 100)).toEqual({
      x: 1,
      y: 0.5,
    });
  });
  it("is stationary at the target", () => {
    expect(stepToward({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }, 16)).toEqual({
      x: 0.3,
      y: 0.3,
    });
  });
});

describe("shouldEmit", () => {
  it("always emits the first position", () => {
    expect(shouldEmit(null, 0, { x: 0.5, y: 0.5 }, 0)).toBe(true);
  });
  it("suppresses within the min interval", () => {
    expect(
      shouldEmit(
        { x: 0, y: 0 },
        1000,
        { x: 1, y: 1 },
        1000 + EMIT_MIN_INTERVAL_MS - 1,
      ),
    ).toBe(false);
  });
  it("suppresses sub-delta jitter even after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.5001, y: 0.5 }, 500)).toBe(
      false,
    );
  });
  it("emits a real move after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.6, y: 0.5 }, 500)).toBe(
      true,
    );
  });
});

describe("spawnFor", () => {
  it("is deterministic and in-bounds", () => {
    const a1 = spawnFor("profile-a");
    expect(spawnFor("profile-a")).toEqual(a1);
    expect(a1.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(a1.x).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    expect(a1.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(a1.y).toBeLessThanOrEqual(1 - ROOM_MARGIN);
  });
  it("spreads different ids apart", () => {
    const a = spawnFor("profile-a");
    const b = spawnFor("profile-b");
    expect(a).not.toEqual(b);
  });
});

describe("initialOf", () => {
  it("returns the first character (hangul + latin)", () => {
    expect(initialOf("김철수")).toBe("김");
    expect(initialOf("Alice")).toBe("A");
  });
  it("falls back to ? for empty", () => {
    expect(initialOf("  ")).toBe("?");
  });
});
