import { parsePreferenceSignals } from "./preference-signals.schema";

describe("parsePreferenceSignals", () => {
  it("accepts a well-formed object", () => {
    const out = parsePreferenceSignals({
      vibe: "calm", activity: ["Boardgame"], drinking: "none",
      pace: "slow", tags: ["Quiet", "boardgame"], summary: "조용한 보드게임 모임",
    });
    expect(out.vibe).toBe("calm");
    expect(out.activity).toEqual(["boardgame"]);      // lowercased+trimmed
    expect(out.tags).toEqual(["quiet", "boardgame"]);
    expect(out.drinking).toBe("none");
  });

  it("coerces unknown enums to safe defaults and clamps arrays/summary", () => {
    const out = parsePreferenceSignals({
      vibe: "wild", drinking: "heavy", pace: "instant",
      activity: Array.from({ length: 20 }, (_, i) => `a${i}`),
      tags: undefined, summary: "x".repeat(200),
    });
    expect(out.vibe).toBe("balanced");
    expect(out.drinking).toBe("light");
    expect(out.pace).toBe("medium");
    expect(out.activity).toHaveLength(10);
    expect(out.tags).toEqual([]);
    expect(out.summary).toHaveLength(120);
  });

  it("throws when the input is not an object", () => {
    expect(() => parsePreferenceSignals("nope")).toThrow();
    expect(() => parsePreferenceSignals(null)).toThrow();
    expect(() => parsePreferenceSignals([])).toThrow();
  });
});
