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

  /** 동네 이름으로 좌표 찾기(포워드 지오코딩) — 사용자가 "내가 갈 동네"를 직접 고를 때 쓴다.
   *  Nominatim은 키가 없고 초당 1회 권고라, 클라이언트가 입력을 디바운스해서 부른다. */
  async searchAreas(query: string): Promise<AreaHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
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
      return hits;
    } catch (e) {
      this.log.warn(`area search failed: ${(e as Error).message}`);
      return [];
    }
  }

  /** 네이버 지역검색은 한 요청당 최대 5건(display 상한)이라, 목록을 채우려면 질의를 나눠 던져야 한다. */
  static readonly MAX_PER_QUERY = 5;

  async searchLocal(
    query: string,
    display = NaverSearchService.MAX_PER_QUERY,
    sort: "random" | "comment" = "random",
  ): Promise<NaverPlace[]> {
    const creds = this.creds();
    if (!creds) throw new ServiceUnavailableException("네이버 검색이 설정되지 않았습니다");
    const url =
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}` +
      `&display=${Math.min(display, NaverSearchService.MAX_PER_QUERY)}&sort=${sort}`;
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
