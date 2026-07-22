import { describe, it, expect } from "vitest";
import {
  PARTY_MAP,
  WORLD_ASPECT,
  CHAR_R,
  ROOM_MARGIN,
  BALANCE_STATION_ID,
  isSolid,
  solidFurniture,
  worldDist,
  type FurnitureDef,
  type DecoDef,
} from "./map.js";

/** world 좌표(x×aspect, y)에서 점→AABB 최단거리. */
function pointRectDistWorld(px: number, py: number, f: FurnitureDef): number {
  const wx = px * WORLD_ASPECT;
  const wy = py;
  const x1 = f.x * WORLD_ASPECT;
  const x2 = (f.x + f.w) * WORLD_ASPECT;
  const y1 = f.y;
  const y2 = f.y + f.h;
  const dx = Math.max(x1 - wx, 0, wx - x2);
  const dy = Math.max(y1 - wy, 0, wy - y2);
  return Math.hypot(dx, dy);
}

function rectsOverlap(a: { x1: number; y1: number; x2: number; y2: number }, f: FurnitureDef) {
  return a.x1 < f.x + f.w && a.x2 > f.x && a.y1 < f.y + f.h && a.y2 > f.y;
}

describe("PARTY_MAP integrity", () => {
  const solids = solidFurniture();

  it("aspect/CHAR_R/margin 상수가 계약값이다", () => {
    expect(WORLD_ASPECT).toBe(3.0);
    expect(CHAR_R).toBe(0.035);
    expect(ROOM_MARGIN).toBe(0.03);
  });

  it("가구 id는 유일하고 AABB는 방(0..1) 안에 있다", () => {
    const ids = PARTY_MAP.furniture.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of PARTY_MAP.furniture) {
      expect(f.w).toBeGreaterThan(0);
      expect(f.h).toBeGreaterThan(0);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(1);
      expect(f.y + f.h).toBeLessThanOrEqual(1);
    }
  });

  it("rug/stage만 통행 가능, 나머지는 solid", () => {
    expect(isSolid("rug")).toBe(false);
    expect(isSolid("stage")).toBe(false);
    for (const kind of ["bar", "table", "sofa", "dj", "plant"] as const) {
      expect(isSolid(kind)).toBe(true);
    }
    expect(solids.every((f) => isSolid(f.kind))).toBe(true);
  });

  it("스테이션은 8개 이상, id 유일, 실존 가구 참조, margin 안쪽", () => {
    expect(PARTY_MAP.stations.length).toBeGreaterThanOrEqual(8);
    const ids = PARTY_MAP.stations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const furnitureIds = new Set(PARTY_MAP.furniture.map((f) => f.id));
    for (const s of PARTY_MAP.stations) {
      expect(furnitureIds.has(s.furnitureId)).toBe(true);
      expect(s.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
      expect(s.x).toBeLessThanOrEqual(1 - ROOM_MARGIN);
      expect(s.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
      expect(s.y).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    }
  });

  it("모든 스테이션 앵커는 solid 가구에서 CHAR_R 이상 떨어져 서 있을 수 있다", () => {
    for (const s of PARTY_MAP.stations) {
      for (const f of solids) {
        expect(pointRectDistWorld(s.x, s.y, f)).toBeGreaterThanOrEqual(CHAR_R);
      }
    }
  });

  it("밸런스 스테이션(st-dj)이 존재한다", () => {
    expect(PARTY_MAP.stations.some((s) => s.id === BALANCE_STATION_ID)).toBe(true);
  });

  it("spawnZone은 margin 안쪽이고 solid 가구와 겹치지 않는다(CHAR_R 확장 포함)", () => {
    const z = PARTY_MAP.spawnZone;
    const rx = CHAR_R / WORLD_ASPECT; // world 반지름의 x축 정규화 환산
    expect(z.x - rx).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(z.x + z.w + rx).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    expect(z.y - CHAR_R).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(z.y + z.h + CHAR_R).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    const expanded = { x1: z.x - rx, y1: z.y - CHAR_R, x2: z.x + z.w + rx, y2: z.y + z.h + CHAR_R };
    for (const f of solids) {
      expect(rectsOverlap(expanded, f)).toBe(false);
    }
  });

  it("deco 레이어는 방(0..1) 안에 있고 충돌 데이터가 아니다", () => {
    const deco = PARTY_MAP.deco ?? [];
    expect(deco.length).toBeGreaterThan(0);
    const ids = deco.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of deco) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.x + d.w).toBeLessThanOrEqual(1);
      expect(d.y + d.h).toBeLessThanOrEqual(1);
    }
    // deco는 solidFurniture에 절대 섞이지 않는다(충돌 무관)
    const solidIds = new Set(solidFurniture().map((f) => f.id));
    for (const d of deco) expect(solidIds.has(d.id)).toBe(false);
  });
});

describe("worldDist", () => {
  it("y축은 그대로, x축은 aspect 배로 잰다", () => {
    expect(worldDist({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.1, 10);
    expect(worldDist({ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.5 })).toBeCloseTo(0.1 * WORLD_ASPECT, 10);
  });
  it("대칭이다", () => {
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.4, y: 0.7 };
    expect(worldDist(a, b)).toBeCloseTo(worldDist(b, a), 10);
  });
});
