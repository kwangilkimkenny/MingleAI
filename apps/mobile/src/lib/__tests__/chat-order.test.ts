import { describe, it, expect } from "vitest";
import { newestFirst, mergeNewest } from "../chat-order";

const m = (id: string, createdAt: string) => ({ id, createdAt });

describe("newestFirst", () => {
  it("flips the server's oldest-first history for the inverted list", () => {
    const history = [m("a", "2026-08-07T01:00:00Z"), m("b", "2026-08-07T02:00:00Z"), m("c", "2026-08-07T03:00:00Z")];
    expect(newestFirst(history).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input", () => {
    const history = [m("a", "2026-08-07T01:00:00Z"), m("b", "2026-08-07T02:00:00Z")];
    newestFirst(history);
    expect(history.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("breaks ties by id so equal timestamps keep a stable order", () => {
    const same = [m("a", "2026-08-07T01:00:00Z"), m("b", "2026-08-07T01:00:00Z")];
    expect(newestFirst(same).map((x) => x.id)).toEqual(["b", "a"]);
    expect(newestFirst([...same].reverse()).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("handles empty and single-item lists", () => {
    expect(newestFirst([])).toEqual([]);
    expect(newestFirst([m("a", "2026-08-07T01:00:00Z")]).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("mergeNewest", () => {
  it("prepends only the messages we do not have yet, newest first", () => {
    const prev = [m("c", "2026-08-07T03:00:00Z"), m("b", "2026-08-07T02:00:00Z")];
    const fresh = [m("b", "2026-08-07T02:00:00Z"), m("d", "2026-08-07T04:00:00Z"), m("e", "2026-08-07T05:00:00Z")];
    expect(mergeNewest(prev, fresh).map((x) => x.id)).toEqual(["e", "d", "c", "b"]);
  });

  it("returns the same array reference when nothing is new (no wasted re-render)", () => {
    const prev = [m("a", "2026-08-07T01:00:00Z")];
    expect(mergeNewest(prev, [m("a", "2026-08-07T01:00:00Z")])).toBe(prev);
  });
});
