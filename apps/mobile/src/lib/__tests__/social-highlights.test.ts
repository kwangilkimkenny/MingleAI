import { describe, expect, it } from "vitest";
import type { GameReveal } from "@mingle/shared";
import { strongestBalanceConnection } from "../social-highlights";

const reveals: GameReveal[] = [
  {
    round: 0,
    question: { a: "계획 여행", b: "즉흥 여행" },
    aVoters: ["me", "p1"],
    bVoters: ["p2"],
  },
  {
    round: 1,
    question: { a: "바다", b: "산" },
    aVoters: ["p2"],
    bVoters: ["me", "p1"],
  },
];

describe("strongestBalanceConnection", () => {
  it("returns the peer with the most actual shared revealed choices", () => {
    expect(
      strongestBalanceConnection(reveals, "me", [
        { profileId: "p1", name: "민지" },
        { profileId: "p2", name: "준" },
      ]),
    ).toEqual({
      peerId: "p1",
      peerName: "민지",
      sharedCount: 2,
      answeredRounds: 2,
      latestSharedChoice: "산",
    });
  });

  it("does not expose a highlight when the viewer did not answer or matched nobody", () => {
    expect(strongestBalanceConnection(reveals, "absent", [{ profileId: "p1", name: "민지" }])).toBeNull();
    expect(strongestBalanceConnection(reveals, "me", [{ profileId: "p2", name: "준" }])).toBeNull();
  });
});
