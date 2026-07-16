import type { Vec2 } from "./party-space";

/** 노브 이동 반경(px). 베이스 지름 = STICK_RADIUS*2 + 패딩. */
export const STICK_RADIUS = 44;
/** 이 비율 미만의 틸트는 무시(손떨림 방지). */
export const STICK_DEAD_ZONE = 0.15;

/** 제스처 오프셋(px, grant 기준) → 크기 ≤1 속도 벡터. */
export function stickVector(dx: number, dy: number, radius: number = STICK_RADIUS): Vec2 {
  if (radius <= 0) return { x: 0, y: 0 };
  let vx = dx / radius;
  let vy = dy / radius;
  const mag = Math.hypot(vx, vy);
  if (mag < STICK_DEAD_ZONE) return { x: 0, y: 0 };
  if (mag > 1) {
    vx /= mag;
    vy /= mag;
  }
  return { x: vx, y: vy };
}

/** 노브 비주얼 오프셋 — 베이스 원 안으로 클램프. */
export function knobOffset(dx: number, dy: number, radius: number = STICK_RADIUS): Vec2 {
  const mag = Math.hypot(dx, dy);
  if (mag <= radius) return { x: dx, y: dy };
  return { x: (dx / mag) * radius, y: (dy / mag) * radius };
}
