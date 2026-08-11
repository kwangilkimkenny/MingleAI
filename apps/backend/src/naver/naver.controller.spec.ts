import { NaverController } from "./naver.controller";
import type { NaverPlace } from "./naver-search.service";

const place = (title: string, addr = "서울 중구 세종대로 1"): NaverPlace => ({
  title,
  category: "음식점>카페",
  address: addr,
  roadAddress: addr,
  telephone: "",
  link: "",
  mapx: "1269700000",
  mapy: "375600000",
});

function make(searchLocal: jest.Mock, configured = true) {
  const naver = { configured, searchLocal, reverseArea: jest.fn().mockResolvedValue("태평로1가") };
  return new NaverController(naver as never);
}

describe("NaverController#nearby", () => {
  it("merges several capped queries and drops duplicates (Naver returns ≤5 per call)", async () => {
    const searchLocal = jest
      .fn()
      .mockResolvedValueOnce([place("A"), place("B")])
      .mockResolvedValueOnce([place("B"), place("C")]) // B is a duplicate
      .mockResolvedValueOnce([place("D")]);
    const res = await make(searchLocal).nearby("카페", "37.56", "126.97");
    expect(searchLocal).toHaveBeenCalledTimes(3);
    expect(res.places.map((p) => p.title)).toEqual(["A", "B", "C", "D"]);
    expect(res.area).toBe("태평로1가");
  });

  it("keeps the same title at a different address (different branch)", async () => {
    const searchLocal = jest
      .fn()
      .mockResolvedValueOnce([place("스타벅스", "세종대로 1")])
      .mockResolvedValueOnce([place("스타벅스", "세종대로 99")])
      .mockResolvedValueOnce([]);
    const res = await make(searchLocal).nearby("카페", "37.56", "126.97");
    expect(res.places).toHaveLength(2);
  });

  it("still answers when some variants fail", async () => {
    const searchLocal = jest
      .fn()
      .mockRejectedValueOnce(new Error("naver 500"))
      .mockResolvedValueOnce([place("A")])
      .mockRejectedValueOnce(new Error("naver 500"));
    const res = await make(searchLocal).nearby("카페", "37.56", "126.97");
    expect(res.places.map((p) => p.title)).toEqual(["A"]);
  });

  it("propagates the failure when every variant fails", async () => {
    const searchLocal = jest.fn().mockRejectedValue(new Error("naver down"));
    await expect(make(searchLocal).nearby("카페", "37.56", "126.97")).rejects.toThrow("naver down");
  });

  // 2026-08-11: "전체"가 `query=맛집` 한 줄이던 시절, 전체(9곳)가 레스토랑(10곳)보다 적게 나왔다.
  it("treats an empty/전체/맛집 query as the union of every 업종", async () => {
    for (const key of ["", "전체", "맛집"]) {
      const searchLocal = jest.fn().mockResolvedValue([]);
      await make(searchLocal).nearby(key, "37.56", "126.97");
      const asked = searchLocal.mock.calls.map((c) => c[0] as string);
      expect(asked).toHaveLength(6); // 업종 6종 × 1변형
      expect(asked.every((q) => q.startsWith("태평로1가 "))).toBe(true);
      expect(new Set(asked).size).toBe(6); // 서로 다른 업종
      expect(asked.some((q) => q.includes("레스토랑"))).toBe(true);
      expect(asked.some((q) => q.includes("오마카세"))).toBe(true);
    }
  });

  it("depth=2 widens both the 업종 union and a single category", async () => {
    const all = jest.fn().mockResolvedValue([]);
    await make(all).nearby("", "37.56", "126.97", "2");
    expect(all).toHaveBeenCalledTimes(12); // 업종 6종 × 2정렬

    const one = jest.fn().mockResolvedValue([]);
    await make(one).nearby("카페", "37.56", "126.97", "2");
    expect(one).toHaveBeenCalledTimes(7); // 기본 3 + 수식어 4
  });

  // 한 번에 다 던지면 네이버가 429를 뱉어 변형이 조용히 빠진다 — 3개씩 끊어 순차로 던진다.
  it("never fires more than 3 queries at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const searchLocal = jest.fn().mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return [];
    });
    await make(searchLocal).nearby("", "37.56", "126.97", "2");
    expect(searchLocal).toHaveBeenCalledTimes(12);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("reports unconfigured without calling out", async () => {
    const searchLocal = jest.fn();
    const res = await make(searchLocal, false).nearby("카페");
    expect(res).toEqual({ configured: false, area: null, places: [] });
    expect(searchLocal).not.toHaveBeenCalled();
  });
});
