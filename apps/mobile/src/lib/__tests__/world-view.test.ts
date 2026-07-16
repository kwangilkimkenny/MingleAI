import { describe, it, expect } from "vitest";
import { worldFrame } from "../world-view";

describe("worldFrame", () => {
  it("납작한 컨테이너: 높이 제한, 가로 중앙 정렬", () => {
    const f = worldFrame(2000, 500, 1.9);
    expect(f.height).toBe(500);
    expect(f.width).toBeCloseTo(950, 6);
    expect(f.left).toBeCloseTo((2000 - 950) / 2, 6);
    expect(f.top).toBe(0);
  });
  it("길쭉한 컨테이너: 폭 제한, 세로 중앙 정렬", () => {
    const f = worldFrame(950, 900, 1.9);
    expect(f.width).toBe(950);
    expect(f.height).toBeCloseTo(500, 6);
    expect(f.top).toBeCloseTo(200, 6);
    expect(f.left).toBe(0);
  });
  it("0 이하 컨테이너 방어", () => {
    expect(worldFrame(0, 500)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
