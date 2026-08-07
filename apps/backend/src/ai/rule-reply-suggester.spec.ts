import { RuleReplySuggester } from "./rule-reply-suggester";

it("labels itself as the rule fallback, not AI", () => {
  expect(new RuleReplySuggester().kind).toBe("rule");
});

it("returns three lines from the shared rule engine", async () => {
  const out = await new RuleReplySuggester().suggest({
    turns: [{ role: "peer", content: "여행 다니는 걸 좋아해요" }],
  });
  expect(out).toHaveLength(3);
  expect(out.some((s) => s.includes("여행"))).toBe(true);
});
