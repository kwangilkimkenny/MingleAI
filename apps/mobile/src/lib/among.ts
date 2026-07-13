import type { Vec2 } from "./party-space";
import type { AmongTaskView, AmongPlayerView, AmongBodyView } from "@mingle/shared";

/** Proximity thresholds in normalized room coordinates. */
export const RANGE = { task: 0.1, kill: 0.12 } as const;

/** Euclidean distance between two normalized-coordinate points. */
export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Return the closest incomplete task within `range`, or null.
 * Ignores tasks where `done === true`. Ties: first minimal (array order).
 */
export function nearestTask(
  myPos: Vec2,
  tasks: AmongTaskView[],
  range: number,
): AmongTaskView | null {
  let best: AmongTaskView | null = null;
  let bestDist = Infinity;

  for (const t of tasks) {
    if (t.done) continue;
    const d = dist(myPos, { x: t.x, y: t.y });
    if (d <= range && d < bestDist) {
      best = t;
      bestDist = d;
    }
  }

  return best;
}

/**
 * Return the closest alive non-self player (with a known position) within `range`, or null.
 * Player positions come from the `positions` map (live movement), not the player view.
 * Ties: first minimal (array order).
 */
export function nearestKillTarget(
  myPos: Vec2,
  players: AmongPlayerView[],
  positions: Record<string, Vec2>,
  range: number,
  myProfileId: string,
): AmongPlayerView | null {
  let best: AmongPlayerView | null = null;
  let bestDist = Infinity;

  for (const p of players) {
    if (!p.alive) continue;
    if (p.profileId === myProfileId) continue;
    const pos = positions[p.profileId];
    if (!pos) continue;
    const d = dist(myPos, pos);
    if (d <= range && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }

  return best;
}

/**
 * Return the closest body within `range`, or null.
 * Callers are responsible for filtering which bodies to pass (e.g. unreported only).
 * Ties: first minimal (array order).
 */
export function nearbyBody(
  myPos: Vec2,
  bodies: AmongBodyView[],
  range: number,
): AmongBodyView | null {
  let best: AmongBodyView | null = null;
  let bestDist = Infinity;

  for (const b of bodies) {
    const d = dist(myPos, { x: b.x, y: b.y });
    if (d <= range && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }

  return best;
}
