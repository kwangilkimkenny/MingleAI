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

  // 재연결 시나리오: 끊긴 동안 쌓인 메시지를 서버에서 다시 받아 합친다(chat 화면 onReconnect).
  it("fills a gap from a reconnect without duplicating or reordering what we already had", () => {
    const have = [
      { id: "m5", createdAt: "2026-08-11T00:00:05.000Z" },
      { id: "m1", createdAt: "2026-08-11T00:00:01.000Z" },
    ];
    // 서버 히스토리는 오래된 → 최신 순으로 온다. m2·m3는 끊긴 동안 놓친 것.
    const fresh = [
      { id: "m1", createdAt: "2026-08-11T00:00:01.000Z" },
      { id: "m2", createdAt: "2026-08-11T00:00:02.000Z" },
      { id: "m3", createdAt: "2026-08-11T00:00:03.000Z" },
      { id: "m5", createdAt: "2026-08-11T00:00:05.000Z" },
    ];

    const merged = mergeNewest(have, fresh);

    // 놓친 m2·m3가 내가 방금 보낸 m5보다 앞(=더 최근)으로 꽂히면 안 된다. 전체 시간순이 진실이다.
    expect(merged.map((m) => m.id)).toEqual(["m5", "m3", "m2", "m1"]);
    expect(new Set(merged.map((m) => m.id)).size).toBe(merged.length);
  });
});