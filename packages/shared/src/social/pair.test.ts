import { describe, it, expect } from "vitest";
import { normalizeMatchPair, blockPairKey } from "./pair.js";

describe("normalizeMatchPair", () => {
  it("returns the two ids sorted ascending regardless of argument order", () => {
    expect(normalizeMatchPair("b", "a")).toEqual(["a", "b"]);
    expect(normalizeMatchPair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("blockPairKey", () => {
  it("is order-independent", () => {
    expect(blockPairKey("x", "y")).toBe(blockPairKey("y", "x"));
  });
});
