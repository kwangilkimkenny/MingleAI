export interface Vec2 {
  x: number;
  y: number;
}

export const ROOM_MARGIN = 0.06; // avatar-radius margin, normalized
export const MOVE_SPEED = 0.35; // normalized units per second
export const EMIT_MIN_INTERVAL_MS = 100; // ≤10Hz network emits
export const EMIT_MIN_DELTA = 0.005; // normalized min movement to emit

/** Clamp a point into the walkable room (margin-inset unit square). */
export function clampToRoom(p: Vec2): Vec2 {
  const clamp = (v: number) =>
    Math.min(Math.max(v, ROOM_MARGIN), 1 - ROOM_MARGIN);
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** One animation step toward target at MOVE_SPEED; snaps when closer than the step. */
export function stepToward(current: Vec2, target: Vec2, dtMs: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = MOVE_SPEED * (dtMs / 1000);
  if (dist === 0 || dist <= step) return { x: target.x, y: target.y };
  return {
    x: current.x + (dx / dist) * step,
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

/** Deterministic spawn point from a profileId (djb2 hash spread over the room). */
export function spawnFor(profileId: string): Vec2 {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (h % 1000) / 1000;
  const gy = (Math.floor(h / 1000) % 1000) / 1000;
  return clampToRoom({ x: 0.15 + gx * 0.7, y: 0.15 + gy * 0.7 });
}

/** First grapheme-ish initial for the avatar label. */
export function initialOf(name: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? [...trimmed][0]! : "?";
}
