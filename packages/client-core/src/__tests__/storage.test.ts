import { describe, it, expect } from "vitest";
import { createMemoryStorage } from "../storage.js";

describe("createMemoryStorage", () => {
  it("round-trips and removes values", async () => {
    const s = createMemoryStorage();
    expect(await s.getItem("k")).toBeNull();
    await s.setItem("k", "v");
    expect(await s.getItem("k")).toBe("v");
    await s.removeItem("k");
    expect(await s.getItem("k")).toBeNull();
  });
});
