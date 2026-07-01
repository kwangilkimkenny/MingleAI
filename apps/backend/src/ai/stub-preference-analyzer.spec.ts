import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";

describe("StubPreferenceAnalyzer", () => {
  const a = new StubPreferenceAnalyzer();

  it("maps quiet boardgame text to calm/boardgame/none", async () => {
    const out = await a.analyze({
      partyPreferenceText: "조용히 보드게임 하면서 술 없이 천천히",
      gender: "female", age: 27, occupation: "designer",
    });
    expect(out.vibe).toBe("calm");
    expect(out.activity).toContain("boardgame");
    expect(out.drinking).toBe("none");
    expect(out.pace).toBe("slow");
  });

  it("is deterministic and always returns valid signals", async () => {
    const input = { partyPreferenceText: "활발하게 떠들기", gender: "male", age: 30, occupation: "dev" };
    const a1 = await a.analyze(input);
    const a2 = await a.analyze(input);
    expect(a1).toEqual(a2);
    expect(a1.vibe).toBe("energetic");
  });
});
