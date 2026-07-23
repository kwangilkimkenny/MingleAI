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
});
