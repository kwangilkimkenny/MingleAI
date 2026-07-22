import { describe, it, expect } from "vitest";
import { buildRotationSchedule } from "./schedule.js";

describe("buildRotationSchedule", () => {
  it("produces N rounds of N pairs for equal groups", () => {
    const sched = buildRotationSchedule(["m0", "m1", "m2"], ["f0", "f1", "f2"]);
    expect(sched).toHaveLength(3);
    for (const round of sched) expect(round).toHaveLength(3);
  });

  it("pairs every male with every female exactly once across all rounds", () => {
    const males = ["m0", "m1", "m2"];
    const females = ["f0", "f1", "f2"];
    const sched = buildRotationSchedule(males, females);
    const seen = new Set<string>();
    for (const round of sched) {
      for (const [m, f] of round) seen.add(`${m}:${f}`);
    }
    expect(seen.size).toBe(9);
    for (const m of males) for (const f of females) expect(seen.has(`${m}:${f}`)).toBe(true);
  });

  it("keeps males and females distinct within each round (no double-booking)", () => {
    const sched = buildRotationSchedule(["m0", "m1", "m2"], ["f0", "f1", "f2"]);
    for (const round of sched) {
      const males = round.map(([m]) => m);
      const females = round.map(([, f]) => f);
      expect(new Set(males).size).toBe(round.length);
      expect(new Set(females).size).toBe(round.length);
    }
  });

  it("matches the documented rotation for 3x3", () => {
    const sched = buildRotationSchedule(["m0", "m1", "m2"], ["f0", "f1", "f2"]);
    expect(sched[0]).toEqual([
      ["m0", "f0"],
      ["m1", "f1"],
      ["m2", "f2"],
    ]);
    expect(sched[1]).toEqual([
      ["m0", "f1"],
      ["m1", "f2"],
      ["m2", "f0"],
    ]);
    expect(sched[2]).toEqual([
      ["m0", "f2"],
      ["m1", "f0"],
      ["m2", "f1"],
    ]);
  });

  it("throws when the two groups differ in size", () => {
    expect(() => buildRotationSchedule(["m0", "m1"], ["f0"])).toThrow();
  });
});
