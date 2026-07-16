import { describe, it, expect } from "vitest";
import { stickVector, knobOffset, STICK_RADIUS, STICK_DEAD_ZONE } from "../joystick";

describe("stickVector", () => {
  it("반경 0 이하 방어", () => {
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });
  it("데드존 안은 0 벡터", () => {
    const inside = STICK_RADIUS * (STICK_DEAD_ZONE - 0.01);
    expect(stickVector(inside, 0)).toEqual({ x: 0, y: 0 });
  });
  it("데드존 밖 중간 틸트는 비례 벡터", () => {
    const v = stickVector(STICK_RADIUS * 0.5, 0);
    expect(v.x).toBeCloseTo(0.5, 10);
    expect(v.y).toBe(0);
  });
  it("반경 초과 드래그는 크기 1로 클램프", () => {
    const v = stickVector(STICK_RADIUS * 3, STICK_RADIUS * 4);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 10);
    expect(v.x / v.y).toBeCloseTo(3 / 4, 10);
  });
});

describe("knobOffset", () => {
  it("반경 안은 그대로", () => {
    expect(knobOffset(10, -5)).toEqual({ x: 10, y: -5 });
  });
  it("반경 밖은 원둘레로 클램프", () => {
    const o = knobOffset(STICK_RADIUS * 3, STICK_RADIUS * 4);
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(STICK_RADIUS, 10);
  });
});
