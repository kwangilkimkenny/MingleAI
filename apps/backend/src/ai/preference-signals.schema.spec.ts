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

  // C1: unrelated JSON objects must throw so the retry/null path fires
  it("throws for an object with no recognizable preference keys", () => {
    expect(() => parsePreferenceSignals({ error: { message: "rate limited" }, code: 429 })).toThrow(
      "no recognizable preference fields in LLM response"
    );
    expect(() => parsePreferenceSignals({ note: "I couldn't understand" })).toThrow();
  });

  it("does NOT throw when at least one known key is present (e.g. vibe only)", () => {
    const out = parsePreferenceSignals({ vibe: "balanced" });
    expect(out.vibe).toBe("balanced");
    expect(out.tags).toEqual([]);
    expect(out.summary).toBe("");
  });

  // I2+M5: normalizeList must filter out non-string elements
  it("drops non-string elements from activity/tags arrays", () => {
    const out = parsePreferenceSignals({
      vibe: "calm",
      tags: [null, {}, "OK"],
    });
    expect(out.tags).toEqual(["ok"]);
  });

  // I4: summary sanitization — control chars and lone surrogates are stripped; slice is code-point safe
  it("strips control characters from summary", () => {
    const out = parsePreferenceSignals({ vibe: "calm", summary: "hello\x00world\x1F!" });
    expect(out.summary).not.toMatch(/[\x00-\x1F]/);
    expect(out.summary).toBe("helloworld!");
  });

  it("strips lone surrogates from summary and stays within 120 code points", () => {
    // Build a string of 130 emoji (each = 2 UTF-16 units / 1 code point)
    const longEmoji = "𝓐".repeat(130);
    const out = parsePreferenceSignals({ vibe: "calm", summary: longEmoji });
    expect(Array.from(out.summary).length).toBeLessThanOrEqual(120);
    // No lone surrogates: JSON.stringify must not throw
    expect(() => JSON.stringify(out.summary)).not.toThrow();
  });
});
