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

  describe("searchAreas", () => {
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
