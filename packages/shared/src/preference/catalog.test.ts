import { describe, it, expect } from "vitest";
import {
  ACTIVITY_OPTIONS,
  buildPreferenceSignals,
  describePreferences,
  MAX_ACTIVITIES,
  type PreferenceAnswers,
} from "./catalog.js";
import { preferenceScore } from "../matchmaking/score.js";

const answers = (over: Partial<PreferenceAnswers> = {}): PreferenceAnswers => ({
  vibe: "calm",
  pace: "slow",
  drinking: "light",
  activities: ["cafe", "walk"],
  ...over,
});

describe("buildPreferenceSignals", () => {
  it("maps every answer axis straight onto the scoring axes", () => {
    const s = buildPreferenceSignals(answers());
    expect(s.vibe).toBe("calm");
    expect(s.pace).toBe("slow");
    expect(s.drinking).toBe("light");
    expect(s.activity).toEqual(["cafe", "walk"]);
    expect(s.tags).toEqual(["cafe", "walk"]);
  });

  it("drops unknown activities and caps the count", () => {
    const s = buildPreferenceSignals(
      answers({ activities: ["cafe", "nope", "walk", "food", "movie"] }),
    );
    expect(s.activity).toEqual(["cafe", "walk", "food"]);
    expect(s.activity.length).toBeLessThanOrEqual(MAX_ACTIVITIES);
  });

  it("produces a readable Korean summary, appending the optional note", () => {
    expect(describePreferences(answers())).toContain("차분한 분위기");
    expect(describePreferences(answers({ note: "보드게임 좋아해요" }))).toContain(
      "— 보드게임 좋아해요",
    );
  });

  it("separates similar and dissimilar pairs (the whole point of structuring)", () => {
    const same = buildPreferenceSignals(answers());
    const near = buildPreferenceSignals(answers({ activities: ["cafe", "movie"] }));
    const far = buildPreferenceSignals(
      answers({ vibe: "energetic", pace: "fast", drinking: "social", activities: ["sports"] }),
    );
    expect(preferenceScore(same, near)).toBeGreaterThan(preferenceScore(same, far));
    expect(preferenceScore(same, far)).toBeLessThan(0.3);
  });

  it("picks the right Korean object particle for the last activity", () => {
    // 드라이브(받침 없음) → 를, 산책(받침 있음) → 을
    expect(describePreferences(answers({ activities: ["walk"] }))).toContain("산책과 드라이브를 좋아해요");
    expect(describePreferences(answers({ activities: ["movie"] }))).toContain("영화 감상을 좋아해요");
  });

  it("every catalog option carries a label and a summary phrase", () => {
    for (const o of ACTIVITY_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.phrase.length).toBeGreaterThan(0);
    }
  });
});
