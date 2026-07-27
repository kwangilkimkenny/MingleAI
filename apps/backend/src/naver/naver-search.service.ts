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
  private readonly areaCache = new Map<string, string | null>();

  async reverseArea(lat: number, lng: number): Promise<string | null> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (this.areaCache.has(key)) return this.areaCache.get(key) ?? null;
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

  async searchLocal(query: string, display = 10): Promise<NaverPlace[]> {
    const creds = this.creds();
    if (!creds) throw new ServiceUnavailableException("네이버 검색이 설정되지 않았습니다");
    const url =
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}` +
      `&display=${display}&sort=random`;
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
    return (data.items ?? []).map((p) => ({ ...p, title: stripTags(p.title) }));
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}
