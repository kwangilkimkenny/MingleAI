import { describe, it, expect } from "vitest";
import { preferenceScore, DEFAULT_WEIGHTS } from "./score.js";
import type { PreferenceSignals } from "../types/preference.js";

const base: PreferenceSignals = {
  vibe: "calm", drinking: "light", pace: "slow",
  activity: ["boardgame"], tags: ["quiet"], summary: "x",
};

describe("preferenceScore", () => {
  it("returns max score for identical enums + full list overlap", () => {
    // base has 1-item lists; with fixed cap=3, max=13, raw=9 → 9/13
    expect(preferenceScore(base, base)).toBeCloseTo(9 / 13, 5);
  });
  it("returns 0 when nothing matches", () => {
    const other: PreferenceSignals = {
      vibe: "energetic", drinking: "social", pace: "fast",
      activity: ["clubbing"], tags: ["loud"], summary: "y",
    };
    expect(preferenceScore(base, other)).toBe(0);
  });
  it("weights enum agreement and list overlap, normalized to [0,1]", () => {
    const partial: PreferenceSignals = { ...base, drinking: "social", pace: "fast", tags: ["noisy"] };
    const s = preferenceScore(base, partial); // vibe(3) + activity overlap 1*1 = 4 of 13
    expect(s).toBeCloseTo(4 / 13, 5);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it("caps list overlap contribution at 3 and tolerates missing arrays", () => {
    const a: PreferenceSignals = { ...base, activity: ["a","b","c","d","e"], tags: [] };
    const b: PreferenceSignals = { ...base, activity: ["a","b","c","d","e"], tags: [] };
    // identical vibe/drinking/pace(7) + activity capped 1*3 + tags overlap 0 => 10/13
    expect(preferenceScore(a, b)).toBeCloseTo(10 / 13, 5);
    // missing arrays must not throw
    const bad = { vibe: "calm", drinking: "light", pace: "slow" } as unknown as PreferenceSignals;
    expect(() => preferenceScore(bad, bad)).not.toThrow();
  });
  it("DEFAULT_WEIGHTS are vibe3/drinking2/pace2/activity1/tags1", () => {
    expect(DEFAULT_WEIGHTS).toEqual({ vibe: 3, drinking: 2, pace: 2, activity: 1, tags: 1 });
  });
});
