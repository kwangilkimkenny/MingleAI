import { describe, it, expect } from "vitest";
import type { AmongTaskView, AmongPlayerView, AmongBodyView } from "@mingle/shared";
import { WORLD_ASPECT } from "@mingle/shared";
import { dist, nearestTask, nearestKillTarget, nearbyBody, RANGE } from "../among";

// ── helpers ──────────────────────────────────────────────────────────────────

function task(id: string, x: number, y: number, done = false): AmongTaskView {
  return { taskId: id, kind: "wires", x, y, done };
}

function player(profileId: string, alive: boolean): AmongPlayerView {
  return { profileId, name: profileId, alive, role: null };
}

function body(profileId: string, x: number, y: number): AmongBodyView {
  return { profileId, x, y };
}

// ── dist ─────────────────────────────────────────────────────────────────────

describe("dist", () => {
  it("is zero for the same point", () => {
    expect(dist({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
  });

  it("world 계량이다 — x는 aspect 배, y는 그대로", () => {
    expect(dist({ x: 0, y: 0 }, { x: 0.3, y: 0.4 })).toBeCloseTo(
      Math.hypot(0.3 * WORLD_ASPECT, 0.4),
      10,
    );
    expect(dist({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })).toBeCloseTo(0.1, 10);
  });

  it("is symmetric", () => {
    const a = { x: 0.1, y: 0.2 };
    const b = { x: 0.4, y: 0.7 };
    expect(dist(a, b)).toBeCloseTo(dist(b, a), 10);
  });
});

// ── nearestTask ───────────────────────────────────────────────────────────────

describe("nearestTask", () => {
  const myPos = { x: 0.5, y: 0.5 };

  it("returns null when the list is empty", () => {
    expect(nearestTask(myPos, [], RANGE.task)).toBeNull();
  });

  it("ignores tasks that are done", () => {
    const tasks = [task("t1", 0.5, 0.55, true)]; // within range, but done
    expect(nearestTask(myPos, tasks, RANGE.task)).toBeNull();
  });

  it("ignores tasks outside range", () => {
    const tasks = [task("t1", 0.5, 0.9)]; // far away, not done
    expect(nearestTask(myPos, tasks, RANGE.task)).toBeNull();
  });

  it("returns the in-range non-done task", () => {
    const tasks = [task("t1", 0.5, 0.55)]; // 0.05 away, in range, not done
    expect(nearestTask(myPos, tasks, RANGE.task)).toEqual(tasks[0]);
  });

  it("picks the closest of multiple in-range tasks", () => {
    const near = task("near", 0.5, 0.54); // 0.04 away
    const far = task("far", 0.5, 0.58); // 0.08 away
    expect(nearestTask(myPos, [far, near], RANGE.task)).toEqual(near);
  });

  it("ignores done tasks even when closer than non-done ones", () => {
    const doneClose = task("done-close", 0.5, 0.52, true); // 0.02 away, done
    const undonefarther = task("undone-far", 0.5, 0.56); // 0.06 away, not done
    expect(nearestTask(myPos, [doneClose, undonefarther], RANGE.task)).toEqual(undonefarther);
  });

  it("returns first when two tasks are equidistant (deterministic)", () => {
    // Use myPos={x:0,y:0} so dx-only and dy-only deltas produce identical hypot values.
    const origin = { x: 0, y: 0 };
    const t1 = task("t1", 0.04 / WORLD_ASPECT, 0); // east, world 0.04 away
    const t2 = task("t2", 0, 0.04); // south, world 0.04 away
    expect(nearestTask(origin, [t1, t2], RANGE.task)).toEqual(t1);
  });

  it("x 오프셋은 world 계량으로 재서 판정한다 (정규화 0.06 = world 0.06·aspect > range)", () => {
    const tasks = [task("tx", 0.06, 0)];
    expect(nearestTask({ x: 0, y: 0 }, tasks, RANGE.task)).toBeNull();
  });
});

// ── nearestKillTarget ─────────────────────────────────────────────────────────

describe("nearestKillTarget", () => {
  const myPos = { x: 0.5, y: 0.5 };
  const myId = "impostor";

  it("returns null when player list is empty", () => {
    expect(nearestKillTarget(myPos, [], {}, RANGE.kill, myId)).toBeNull();
  });

  it("excludes self", () => {
    const players = [player(myId, true)];
    const positions = { [myId]: { x: 0.5, y: 0.5 } };
    expect(nearestKillTarget(myPos, players, positions, RANGE.kill, myId)).toBeNull();
  });

  it("excludes dead players", () => {
    const players = [player("victim", false)]; // alive=false
    const positions = { victim: { x: 0.5, y: 0.55 } };
    expect(nearestKillTarget(myPos, players, positions, RANGE.kill, myId)).toBeNull();
  });

  it("excludes players with no position entry", () => {
    const players = [player("ghost", true)];
    expect(nearestKillTarget(myPos, players, {}, RANGE.kill, myId)).toBeNull();
  });

  it("excludes players out of range", () => {
    const players = [player("far", true)];
    const positions = { far: { x: 0.5, y: 0.9 } }; // 0.4 away
    expect(nearestKillTarget(myPos, players, positions, RANGE.kill, myId)).toBeNull();
  });

  it("returns an in-range alive non-self player", () => {
    const players = [player("crew", true)];
    const positions = { crew: { x: 0.5, y: 0.56 } }; // 0.06 away
    expect(nearestKillTarget(myPos, players, positions, RANGE.kill, myId)).toEqual(players[0]);
  });

  it("picks the closest of multiple valid targets", () => {
    const near = player("near", true);
    const far = player("far", true);
    const positions = {
      near: { x: 0.5, y: 0.54 }, // 0.04 away
      far: { x: 0.5, y: 0.58 }, // 0.08 away
    };
    expect(nearestKillTarget(myPos, [far, near], positions, RANGE.kill, myId)).toEqual(near);
  });

  it("returns first equidistant target (deterministic)", () => {
    const origin = { x: 0, y: 0 };
    const p1 = player("p1", true);
    const p2 = player("p2", true);
    const positions = {
      p1: { x: 0.04 / WORLD_ASPECT, y: 0 }, // east, world 0.04 away
      p2: { x: 0, y: 0.04 }, // south, world 0.04 away
    };
    expect(nearestKillTarget(origin, [p1, p2], positions, RANGE.kill, myId)).toEqual(p1);
  });
});

// ── nearbyBody ────────────────────────────────────────────────────────────────

describe("nearbyBody", () => {
  const myPos = { x: 0.5, y: 0.5 };

  it("returns null when list is empty", () => {
    expect(nearbyBody(myPos, [], RANGE.task)).toBeNull();
  });

  it("returns null when no body is in range", () => {
    const bodies = [body("b1", 0.5, 0.9)];
    expect(nearbyBody(myPos, bodies, RANGE.task)).toBeNull();
  });

  it("returns a body within range", () => {
    const bodies = [body("b1", 0.5, 0.55)]; // 0.05 away
    expect(nearbyBody(myPos, bodies, RANGE.task)).toEqual(bodies[0]);
  });

  it("picks the closest body", () => {
    const near = body("near", 0.5, 0.54); // 0.04
    const far = body("far", 0.5, 0.58); // 0.08
    expect(nearbyBody(myPos, [far, near], RANGE.task)).toEqual(near);
  });

  it("returns first equidistant body (deterministic)", () => {
    const origin = { x: 0, y: 0 };
    const b1 = body("b1", 0.04 / WORLD_ASPECT, 0); // east, world 0.04 away
    const b2 = body("b2", 0, 0.04); // south, world 0.04 away
    expect(nearbyBody(origin, [b1, b2], RANGE.task)).toEqual(b1);
  });
});
