import { ServiceUnavailableException } from "@nestjs/common";
import { NaverSearchService } from "./naver-search.service";

describe("NaverSearchService", () => {
  const OLD = { ...process.env };
  let svc: NaverSearchService;

  beforeEach(() => {
    svc = new NaverSearchService();
    delete process.env.NAVER_SEARCH_CLIENT_ID;
    delete process.env.NAVER_SEARCH_CLIENT_SECRET;
  });
  afterEach(() => {
    process.env = { ...OLD };
    jest.restoreAllMocks();
  });

  it("reports not configured and refuses search when keys are unset", async () => {
    expect(svc.configured).toBe(false);
    await expect(svc.searchLocal("맛집")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("fetches and strips <b> tags from titles when configured", async () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "id";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
    expect(svc.configured).toBe(true);
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            title: "<b>강남</b> 맛집",
            category: "한식",
            address: "서울 강남구",
            roadAddress: "서울 강남구 테헤란로",
            telephone: "",
            link: "https://naver.me/x",
            mapx: "1270000000",
            mapy: "375000000",
          },
        ],
      }),
    } as unknown as Response);

    const places = await svc.searchLocal("강남 맛집", 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("openapi.naver.com/v1/search/local.json");
    expect((init?.headers as Record<string, string>)["X-Naver-Client-Id"]).toBe("id");
    expect(places[0].title).toBe("강남 맛집");
  });

  it("maps a non-ok response to 503", async () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "id";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 429 } as Response);
    await expect(svc.searchLocal("맛집")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("decodes HTML entities in titles (Naver returns &amp; and friends)", async () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "id";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ title: "프레스센터 연회 <b>&amp;</b> 기자클럽", category: "한식" }],
      }),
    } as unknown as Response);
    const places = await svc.searchLocal("맛집");
    expect(places[0].title).toBe("프레스센터 연회 & 기자클럽");
  });

  it("caps display at the Naver per-request limit", async () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "id";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as unknown as Response);
    await svc.searchLocal("맛집", 50);
    expect(String(fetchMock.mock.calls[0][0])).toContain("display=5");
  });

  it("serves a repeated query from cache instead of spending Naver quota", async () => {
    process.env.NAVER_SEARCH_CLIENT_ID = "id";
    process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ title: "<b>강남</b> 맛집", category: "한식" }] }),
    } as unknown as Response);

    const first = await svc.searchLocal("강남 맛집", 5, "comment");
    const second = await svc.searchLocal("강남 맛집", 5, "comment");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);

    // 정렬이나 질의가 다르면 별개의 결과 — 캐시가 섞이면 안 된다.
    await svc.searchLocal("강남 맛집", 5, "random");
    await svc.searchLocal("홍대 맛집", 5, "comment");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  describe("searchAreas", () => {
    // 2026-08-11 QA: OSM은 한국 행정동에 약해 "성수동"을 제주 애월읍으로 잡았다. 키가 있으면
    // 국내 주소 데이터(네이버)를 먼저 쓰고, 시군구 단위로 묶어 대표 좌표를 준다.
    it("prefers Naver local data and groups hits by 시/도 · 시군구", async () => {
      process.env.NAVER_SEARCH_CLIENT_ID = "id";
      process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
      const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { title: "카페A", address: "서울특별시 성동구 성수동2가 1", mapx: "1270560000", mapy: "375440000" },
            { title: "카페B", address: "서울특별시 성동구 성수동1가 2", mapx: "1270570000", mapy: "375450000" },
            { title: "식당C", address: "경기도 성남시 분당구 3", mapx: "1271100000", mapy: "373800000" },
          ],
        }),
      } as unknown as Response);

      const hits = await svc.searchAreas("성수동");

      expect(fetchMock.mock.calls[0][0]).toContain("openapi.naver.com");
      expect(hits.map((h) => h.detail)).toEqual(["서울특별시 · 성동구", "경기도 · 성남시"]);
      expect(hits[0]).toMatchObject({ label: "성수동", lat: 37.544, lng: 127.056 });
    });

    it("falls back to Nominatim when Naver returns nothing usable", async () => {
      process.env.NAVER_SEARCH_CLIENT_ID = "id";
      process.env.NAVER_SEARCH_CLIENT_SECRET = "secret";
      const fetchMock = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { name: "삼평동", display_name: "삼평동, 분당구, 성남시, 경기도, 대한민국", lat: "37.40", lon: "127.10" },
          ],
        } as unknown as Response);

      const hits = await svc.searchAreas("삼평동");

      expect(fetchMock.mock.calls[1][0]).toContain("nominatim");
      expect(hits[0]).toMatchObject({ label: "삼평동", detail: "분당구 · 경기도" });
    });

    it("turns Nominatim rows into labeled coordinates and drops duplicates", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => [
          { name: "홍대입구역", display_name: "홍대입구역, 양화로, 마포구", lat: "37.5568", lon: "126.9237" },
          { name: "홍대입구역", display_name: "홍대입구역, 양화로, 마포구", lat: "37.5568", lon: "126.9237" },
          { name: "깨진 좌표", display_name: "x", lat: "nope", lon: "126.9" },
        ],
      } as unknown as Response);
      const hits = await svc.searchAreas("홍대입구역");
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ label: "홍대입구역", lat: 37.5568, lng: 126.9237 });
      expect(hits[0].detail).toBe("양화로 · 마포구");
    });

    it("skips the network for a too-short query and never throws on failure", async () => {
      const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      expect(await svc.searchAreas("홍")).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await svc.searchAreas("홍대입구")).toEqual([]);
    });
  });
});
