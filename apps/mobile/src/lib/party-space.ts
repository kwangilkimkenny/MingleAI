import { PARTY_MAP, WORLD_ASPECT, CHAR_R, ROOM_MARGIN, solidFurniture } from "@mingle/shared";
import type { FurnitureDef } from "@mingle/shared";

export interface Vec2 {
  x: number;
  y: number;
}

export { ROOM_MARGIN, WORLD_ASPECT, CHAR_R };

/**
 * 좌표는 정규화 [0,1]²로 저장/전송하되(프로토콜 불변), 거리·속도·충돌은
 * world 계량으로 계산한다: world = (x × WORLD_ASPECT, y). 높이가 1 world 단위.
 * 화면은 WORLD_ASPECT로 aspect-fit 렌더되므로 world 계량 = 시각적 등방 거리.
 */
export const MOVE_SPEED = 0.45; // world units per second, 조이스틱 풀틸트 기준
export const EMIT_MIN_INTERVAL_MS = 100; // ≤10Hz network emits
export const EMIT_MIN_DELTA = 0.005; // normalized min movement to emit
/** 로비 상호작용(프로필/스테이션) 근접 반경, world 단위. */
export const INTERACT_RANGE = 0.14;
/** 충돌 적분 dt 클램프 — 백그라운드 복귀 등 dt 스파이크 시 터널링 방지. */
export const MAX_STEP_DT_MS = 50;

/** Clamp a point into the walkable room (margin-inset unit square). */
export function clampToRoom(p: Vec2): Vec2 {
  const clamp = (v: number) => Math.min(Math.max(v, ROOM_MARGIN), 1 - ROOM_MARGIN);
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** world 계량 유클리드 거리 — 모든 근접 판정(RANGE)은 이걸 쓴다. */
export function worldDist(a: Vec2, b: Vec2): number {
  return Math.hypot((b.x - a.x) * WORLD_ASPECT, b.y - a.y);
}

/** world 좌표 AABB (CHAR_R 민코프스키 확장 포함). */
export interface WorldRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 정규화 가구 AABB → CHAR_R 확장 world rect. */
export function toWorldRects(furniture: readonly FurnitureDef[]): WorldRect[] {
  return furniture.map((f) => ({
    x1: f.x * WORLD_ASPECT - CHAR_R,
    y1: f.y - CHAR_R,
    x2: (f.x + f.w) * WORLD_ASPECT + CHAR_R,
    y2: f.y + f.h + CHAR_R,
  }));
}

const SOLID_WORLD: readonly WorldRect[] = toWorldRects(solidFurniture());

/**
 * 조이스틱 속도 적분 + 축분리 충돌 해소(x 이동→해소, y 이동→해소 = 벽 슬라이딩).
 * vel은 크기 ≤1의 방향 벡터(조이스틱 출력). 반환은 정규화 좌표.
 */
export function moveWithCollision(
  pos: Vec2,
  vel: Vec2,
  dtMs: number,
  rects: readonly WorldRect[] = SOLID_WORLD,
): Vec2 {
  const mag = Math.hypot(vel.x, vel.y);
  if (mag === 0) return pos;
  const nx = vel.x / mag;
  const ny = vel.y / mag;

  let current = pos;
  let remainingDt = dtMs;

  while (remainingDt > 0) {
    const dt = Math.min(remainingDt, MAX_STEP_DT_MS);
    const step = MOVE_SPEED * Math.min(mag, 1) * (dt / 1000);
    let wx = current.x * WORLD_ASPECT;
    let wy = current.y;
    wx += nx * step;
    for (const r of rects) {
      if (wx > r.x1 && wx < r.x2 && wy > r.y1 && wy < r.y2) wx = nx > 0 ? r.x1 : r.x2;
    }
    wy += ny * step;
    for (const r of rects) {
      if (wx > r.x1 && wx < r.x2 && wy > r.y1 && wy < r.y2) wy = ny > 0 ? r.y1 : r.y2;
    }
    current = clampToRoom({ x: wx / WORLD_ASPECT, y: wy });
    remainingDt -= dt;
  }

  return current;
}

/** 원격 피어 스무딩: 목표점을 향한 world-속도 등속 이동, 한 스텝 이내면 스냅. */
export function stepToward(current: Vec2, target: Vec2, dtMs: number): Vec2 {
  const dx = (target.x - current.x) * WORLD_ASPECT;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = MOVE_SPEED * (dtMs / 1000);
  if (dist === 0 || dist <= step) return { x: target.x, y: target.y };
  return {
    x: current.x + ((dx / dist) * step) / WORLD_ASPECT,
    y: current.y + (dy / dist) * step,
  };
}

/** Throttle gate for network emits: min interval AND min distance. */
export function shouldEmit(
  lastSent: Vec2 | null,
  lastSentAtMs: number,
  next: Vec2,
  nowMs: number,
): boolean {
  if (!lastSent) return true;
  if (nowMs - lastSentAtMs < EMIT_MIN_INTERVAL_MS) return false;
  return Math.hypot(next.x - lastSent.x, next.y - lastSent.y) >= EMIT_MIN_DELTA;
}

/** Deterministic spawn point from a profileId — 가구 없는 spawnZone 안에 뿌린다. */
export function spawnFor(profileId: string): Vec2 {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (h % 1000) / 1000;
  const gy = (Math.floor(h / 1000) % 1000) / 1000;
  const z = PARTY_MAP.spawnZone;
  return { x: z.x + gx * z.w, y: z.y + gy * z.h };
}

/** First grapheme-ish initial for the avatar label. */
export function initialOf(name: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? [...trimmed][0]! : "?";
}
