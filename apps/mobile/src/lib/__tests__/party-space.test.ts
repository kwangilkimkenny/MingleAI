import { describe, it, expect } from "vitest";
import { PARTY_MAP, WORLD_ASPECT } from "@mingle/shared";
import {
  clampToRoom,
  stepToward,
  shouldEmit,
  spawnFor,
  initialOf,
  worldDist,
  moveWithCollision,
  toWorldRects,
  ROOM_MARGIN,
  EMIT_MIN_INTERVAL_MS,
  MOVE_SPEED,
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

describe("worldDist", () => {
  it("y축 이동은 그대로, x축 이동은 aspect 배로 잰다", () => {
    expect(worldDist({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.1, 10);
    expect(worldDist({ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.5 })).toBeCloseTo(0.1 * WORLD_ASPECT, 10);
  });
});

describe("stepToward (world 계량)", () => {
  it("x축 목표를 향해 world 스텝만큼 이동 — 정규화로는 aspect로 나눠 짧아진다", () => {
    const next = stepToward({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 100);
    expect(next.x).toBeCloseTo((MOVE_SPEED * 0.1) / WORLD_ASPECT, 5);
    expect(next.y).toBeCloseTo(0.5, 5);
  });
  it("snaps onto the target when closer than one step", () => {
    expect(stepToward({ x: 0.999, y: 0.5 }, { x: 1, y: 0.5 }, 100)).toEqual({ x: 1, y: 0.5 });
  });
  it("is stationary at the target", () => {
    expect(stepToward({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }, 16)).toEqual({ x: 0.3, y: 0.3 });
  });
});

describe("moveWithCollision", () => {
  // 방 중앙에 정사각(world 기준) 장애물: x 0.4~0.5(norm), y 0.4~0.59
  const RECTS = toWorldRects([{ id: "t", kind: "table", x: 0.4, y: 0.4, w: 0.1, h: 0.19 }]);

  it("vel 0이면 제자리", () => {
    const p = { x: 0.5, y: 0.5 };
    expect(moveWithCollision(p, { x: 0, y: 0 }, 16, RECTS)).toBe(p);
  });

  it("장애물 없으면 world 스텝만큼 이동한다", () => {
    const next = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 1 }, 100, []);
    expect(next.y).toBeCloseTo(0.2 + MOVE_SPEED * 0.1, 5);
    expect(next.x).toBeCloseTo(0.5, 10);
  });

  it("스틱 반틸트는 절반 속도다", () => {
    const full = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 1 }, 100, []);
    const half = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 0.5 }, 100, []);
    expect(half.y - 0.2).toBeCloseTo((full.y - 0.2) / 2, 5);
  });

  it("벽에 대각으로 밀면 막힌 축만 멈추고 슬라이딩한다", () => {
    // 장애물 왼쪽에 붙어 서서(CHAR_R 확장 경계 바로 밖) 오른쪽+아래로 민다
    const startX = RECTS[0]!.x1 / WORLD_ASPECT - 1e-9;
    const start = { x: startX, y: 0.5 };
    const next = moveWithCollision(start, { x: 1, y: 1 }, 32, RECTS);
    expect(next.x * WORLD_ASPECT).toBeLessThanOrEqual(RECTS[0]!.x1 + 1e-9); // x는 경계에 고정
    expect(next.y).toBeGreaterThan(start.y); // y는 계속 진행
  });

  it("큰 dt(백그라운드 복귀)에도 얇은 벽을 관통하지 않는다", () => {
    const start = { x: 0.3, y: 0.5 };
    const next = moveWithCollision(start, { x: 1, y: 0 }, 5000, RECTS);
    expect(next.x * WORLD_ASPECT).toBeLessThanOrEqual(RECTS[0]!.x1 + 1e-9);
  });

  it("room margin 밖으로 나가지 않는다", () => {
    const next = moveWithCollision({ x: 0.07, y: 0.07 }, { x: -1, y: -1 }, 100, []);
    expect(next.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(next.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
  });
});

describe("shouldEmit", () => {
  it("always emits the first position", () => {
    expect(shouldEmit(null, 0, { x: 0.5, y: 0.5 }, 0)).toBe(true);
  });
  it("suppresses within the min interval", () => {
    expect(
      shouldEmit({ x: 0, y: 0 }, 1000, { x: 1, y: 1 }, 1000 + EMIT_MIN_INTERVAL_MS - 1),
    ).toBe(false);
  });
  it("suppresses sub-delta jitter even after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.5001, y: 0.5 }, 500)).toBe(false);
  });
  it("emits a real move after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.6, y: 0.5 }, 500)).toBe(true);
  });
});

describe("spawnFor", () => {
  it("결정적이고 spawnZone 안이다", () => {
    const z = PARTY_MAP.spawnZone;
    const a1 = spawnFor("profile-a");
    expect(spawnFor("profile-a")).toEqual(a1);
    expect(a1.x).toBeGreaterThanOrEqual(z.x);
    expect(a1.x).toBeLessThanOrEqual(z.x + z.w);
    expect(a1.y).toBeGreaterThanOrEqual(z.y);
    expect(a1.y).toBeLessThanOrEqual(z.y + z.h);
  });
  it("spreads different ids apart", () => {
    expect(spawnFor("profile-a")).not.toEqual(spawnFor("profile-b"));
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
