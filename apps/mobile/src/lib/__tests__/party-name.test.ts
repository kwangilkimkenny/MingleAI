import { describe, it, expect } from "vitest";
import { resolveDisplayName } from "../party-name";

const participants = [{ profileId: "p1", name: "유아영" }];
const amongPlayers = [
  { profileId: "p1", name: "유아영" },
  { profileId: "ai-1", name: "서지우" },
];

describe("resolveDisplayName", () => {
  it("나 → '나'", () => {
    expect(resolveDisplayName("p1", participants, amongPlayers, "p1")).toBe("나");
  });
  it("파티 참가자 이름 우선", () => {
    expect(resolveDisplayName("p1", participants, amongPlayers, null)).toBe("유아영");
  });
  it("참가자에 없으면 among.players로 폴백(AI 페르소나)", () => {
    expect(resolveDisplayName("ai-1", participants, amongPlayers, null)).toBe("서지우");
  });
  it("둘 다 없으면 '?'", () => {
    expect(resolveDisplayName("ghost", participants, undefined, null)).toBe("?");
  });
});
