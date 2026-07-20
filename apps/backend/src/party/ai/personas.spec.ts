import { pickPersonas, fallbackLine, AI_PROFILE_PREFIX } from "./personas";

describe("pickPersonas", () => {
  it("count만큼 뽑고 profileId는 ai- 접두 + 유일하다", () => {
    const ps = pickPersonas(2, new Set(), () => 0.42);
    expect(ps).toHaveLength(2);
    for (const p of ps) expect(p.profileId.startsWith(AI_PROFILE_PREFIX)).toBe(true);
    expect(new Set(ps.map((p) => p.profileId)).size).toBe(2);
    expect(new Set(ps.map((p) => p.name)).size).toBe(2);
  });

  it("takenNames와 겹치는 이름은 피한다", () => {
    const taken = new Set(["서지우"]);
    for (let i = 0; i < 20; i++) {
      const ps = pickPersonas(2, taken, () => i / 20);
      for (const p of ps) expect(taken.has(p.name)).toBe(false);
    }
  });

  it("주입 rand로 결정적이다", () => {
    const a = pickPersonas(
      2,
      new Set(),
      () => 0.3,
      () => "fixed",
    );
    const b = pickPersonas(
      2,
      new Set(),
      () => 0.3,
      () => "fixed",
    );
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
  });
});

describe("fallbackLine", () => {
  it("scene별 풀에서 비어있지 않은 문장을 준다", () => {
    expect(fallbackLine("idle", () => 0.1).length).toBeGreaterThan(0);
    expect(fallbackLine("meeting", () => 0.9).length).toBeGreaterThan(0);
  });
});
