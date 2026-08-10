import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

/** A place from Naver Local Search. `link` opens the place's Naver page (info + reservation). */
export type NaverPlace = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  link: string;
  mapx: string; // WGS84 longitude ×1e7 (string), for map pins
  mapy: string; // WGS84 latitude ×1e7 (string)
};

/** 사용자가 고른 "갈 동네" 후보 — 이름 + 좌표. */
export type AreaHit = { label: string; detail: string; lat: number; lng: number };

/**
 * 만료·용량 상한이 있는 최소 캐시. 같은 질의를 다시 던지지 않는 것이 쿼터를 아끼는 가장 싼 방법이다:
 * 네이버 지역검색은 일 25,000회 상한인데 `/places/nearby` 한 번이 질의를 3개 던지고, Nominatim은
 * 초당 1회 권고다. 단일 인스턴스 전제(프로세스 메모리) — 다중 인스턴스로 가면 Redis로 옮긴다.
 */
class TtlCache<T> {
  private readonly map = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly max = 500,
  ) {}

  /** 미스는 `undefined`. 값 자체가 null일 수 있으므로(동네 못 찾음) 미스와 구분해서 쓴다. */
  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // 재삽입으로 최근 사용 순서를 유지한다(Map은 삽입 순서를 보존 — 넘칠 때 가장 오래된 것부터 버린다).
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { at: Date.now(), value });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

const HOUR = 60 * 60 * 1000;

/**
 * Naver Local Search adapter (seam). Reads `NAVER_SEARCH_CLIENT_ID/SECRET`; when unset it reports
 * `configured=false` and callers show an empty state (no fake data). No public Naver *reservation*
 * API exists — the place `link` deep-links to Naver where the user can view/reserve.
 */
@Injectable()
export class NaverSearchService {
  private readonly log = new Logger(NaverSearchService.name);

  private creds(): { id: string; secret: string } | null {
    const id = process.env.NAVER_SEARCH_CLIENT_ID;
    const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
  }

  get configured(): boolean {
    return this.creds() !== null;
  }

  /** 좌표 → 동네 이름(구·동). 키 없는 OSM Nominatim — 소수 2자리(±1km) 캐시로 호출을 아낀다.
   *  네이버 로컬 검색은 좌표 파라미터가 없어서, 지역어를 query에 붙여야 '내 주변' 결과가 된다. */
  private readonly areaCache = new TtlCache<string | null>(24 * HOUR, 2000);

  async reverseArea(lat: number, lng: number): Promise<string | null> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const hit = this.areaCache.get(key);
    if (hit !== undefined) return hit;
    let area: string | null = null;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=ko`,
        { headers: { "User-Agent": "mingles/1.0 (date-place search)" } },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          address?: Record<string, string | undefined>;
        };
        const a = data.address ?? {};
        area =
          a.quarter ?? a.suburb ?? a.borough ?? a.city_district ?? a.county ?? a.city ?? null;
      }
    } catch (e) {
      this.log.warn(`reverse geocode failed: ${(e as Error).message}`);
    }
    this.areaCache.set(key, area);
    return area;
  }

  /** 동네 이름으로 좌표 찾기(포워드 지오코딩) — 사용자가 "내가 갈 동네"를 직접 고를 때 쓴다.
   *  Nominatim은 키가 없고 초당 1회 권고라, 클라이언트가 입력을 디바운스해서 부른다. */
  private readonly areaSearchCache = new TtlCache<AreaHit[]>(24 * HOUR);

  async searchAreas(query: string): Promise<AreaHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const cached = this.areaSearchCache.get(q);
    if (cached) return cached;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&limit=8` +
          `&accept-language=ko&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "mingles/1.0 (date-place search)" } },
      );
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
      }>;
      const seen = new Set<string>();
      const hits: AreaHit[] = [];
      for (const r of rows) {
        const lat = Number(r.lat);
        const lng = Number(r.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const parts = (r.display_name ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        const label = r.name?.trim() || parts[0] || q;
        // "서초동, 서초구, 서울" 처럼 상위 두 단계까지만 부제로 — 전체 주소는 너무 길다.
        const detail = parts.slice(1, 3).join(" · ");
        const key = `${label}|${detail}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ label, detail, lat, lng });
      }
      // 빈 결과는 캐시하지 않는다 — 오타를 고쳐 다시 치는 흐름에서 다음 질의를 막지 않는다.
      if (hits.length) this.areaSearchCache.set(q, hits);
      return hits;
    } catch (e) {
      this.log.warn(`area search failed: ${(e as Error).message}`);
      return [];
    }
  }

  /** 네이버 지역검색은 한 요청당 최대 5건(display 상한)이라, 목록을 채우려면 질의를 나눠 던져야 한다. */
  static readonly MAX_PER_QUERY = 5;

  /** 같은 질의의 결과 캐시. 가게 목록은 시간 단위로 바뀌지 않으므로 6시간이면 충분하다.
   *  ⚠️ sort=random은 매번 다른 순서를 주는데, 캐시가 그 무작위성을 고정한다 —
   *  목록을 섞는 책임은 호출부(컨트롤러의 질의 팬아웃)에 있고 쿼터 절약이 더 중요하다. */
  private readonly localCache = new TtlCache<NaverPlace[]>(6 * HOUR);

  async searchLocal(
    query: string,
    display = NaverSearchService.MAX_PER_QUERY,
    sort: "random" | "comment" = "random",
  ): Promise<NaverPlace[]> {
    const creds = this.creds();
    if (!creds) throw new ServiceUnavailableException("네이버 검색이 설정되지 않았습니다");
    const capped = Math.min(display, NaverSearchService.MAX_PER_QUERY);
    const cacheKey = `${sort}|${capped}|${query.trim()}`;
    const cached = this.localCache.get(cacheKey);
    if (cached) return cached;
    const url =
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}` +
      `&display=${capped}&sort=${sort}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "X-Naver-Client-Id": creds.id, "X-Naver-Client-Secret": creds.secret },
      });
    } catch (e) {
      this.log.warn(`naver local search error: ${(e as Error).message}`);
      throw new ServiceUnavailableException("네이버 검색 요청이 실패했습니다");
    }
    if (!res.ok) {
      this.log.warn(`naver local search failed: ${res.status}`);
      throw new ServiceUnavailableException("네이버 검색 요청이 실패했습니다");
    }
    const data = (await res.json()) as { items?: NaverPlace[] };
    // Naver wraps matched query terms in <b> tags — strip them for display.
    const places = (data.items ?? []).map((p) => ({ ...p, title: stripTags(p.title) }));
    // 빈 결과도 캐시한다 — "그 동네엔 그 업종이 없다"도 사실이고, 재시도가 쿼터만 태운다.
    this.localCache.set(cacheKey, places);
    return places;
  }
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** 네이버는 매칭어를 <b>로 감싸고 특수문자를 HTML 엔티티로 준다 — 화면엔 원문 그대로 보여야 한다. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
}
