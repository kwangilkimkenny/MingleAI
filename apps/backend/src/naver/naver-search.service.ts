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
