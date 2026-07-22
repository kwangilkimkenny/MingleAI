import { describe, expect, it } from "vitest";
import { DOODLE_AVATAR_COUNT, lookFor } from "../character-look";

describe("production doodle avatar assignment", () => {
  it("keeps the same profile on the same atlas cell", () => {
    const first = lookFor("profile-stable-id").avatarIndex;
    expect(lookFor("profile-stable-id").avatarIndex).toBe(first);
  });

  it("always returns a valid 4x3 atlas cell", () => {
    for (let index = 0; index < 200; index += 1) {
      const avatarIndex = lookFor(`profile-${index}`).avatarIndex;
      expect(avatarIndex).toBeGreaterThanOrEqual(0);
      expect(avatarIndex).toBeLessThan(DOODLE_AVATAR_COUNT);
    }
  });

  it("uses the available lineup across a normal party population", () => {
    const assigned = new Set(
      Array.from({ length: 96 }, (_, index) => lookFor(`member-${index}`).avatarIndex),
    );
    expect(assigned.size).toBe(DOODLE_AVATAR_COUNT);
  });
});
