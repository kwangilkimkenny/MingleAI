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

  it("reports unconfigured without calling out", async () => {
    const searchLocal = jest.fn();
    const res = await make(searchLocal, false).nearby("카페");
    expect(res).toEqual({ configured: false, area: null, places: [] });
    expect(searchLocal).not.toHaveBeenCalled();
  });
});
