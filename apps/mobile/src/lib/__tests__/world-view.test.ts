import { describe, it, expect } from "vitest";
import { worldFrame, worldCamera } from "../world-view";

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

describe("worldCamera", () => {
  it("월드는 뷰포트보다 크고(aspect 3) 두 축 모두 스크롤 여지가 있다", () => {
    const c = worldCamera(844, 390, { x: 0.5, y: 0.5 }, 3);
    expect(c.worldW).toBeGreaterThan(844);
    expect(c.worldH).toBeGreaterThan(390);
    expect(c.scale).toBeCloseTo(390 * 1.25, 6);
  });
  it("focus를 중앙에 두되 가장자리에서 clamp한다", () => {
    const c = worldCamera(844, 390, { x: 0.5, y: 0.5 }, 3);
    // 중앙 focus는 world 중앙 크롭
    expect(c.offsetX).toBeCloseTo(0.5 * c.worldW - 844 / 2, 6);
    // 좌상단 focus는 offset 0으로 clamp
    const tl = worldCamera(844, 390, { x: 0, y: 0 }, 3);
    expect(tl.offsetX).toBe(0);
    expect(tl.offsetY).toBe(0);
    // 우하단 focus는 최대 offset으로 clamp
    const br = worldCamera(844, 390, { x: 1, y: 1 }, 3);
    expect(br.offsetX).toBeCloseTo(br.worldW - 844, 6);
    expect(br.offsetY).toBeCloseTo(br.worldH - 390, 6);
  });
  it("focus 없으면 중앙", () => {
    const c = worldCamera(844, 390, null, 3);
    expect(c.offsetX).toBeCloseTo(0.5 * c.worldW - 844 / 2, 6);
  });
  it("0 이하 뷰포트 방어", () => {
    expect(worldCamera(0, 390, null, 3)).toEqual({
      worldW: 0,
      worldH: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 0,
    });
  });
});
