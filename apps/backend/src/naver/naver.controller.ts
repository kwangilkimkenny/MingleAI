import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NaverSearchService, type AreaHit, type NaverPlace } from "./naver-search.service";

@Controller("places")
@UseGuards(JwtAuthGuard)
export class NaverController {
  constructor(private readonly naver: NaverSearchService) {}

  /** Nearby restaurants for the 예약 tab. Returns an empty list (not an error) when the
   *  Naver key is unset, so the client shows a graceful empty state. When lat/lng are given the
   *  query is prefixed with the reverse-geocoded neighborhood so results are actually nearby. */
  @Get("nearby")
  async nearby(
    @Query("query") query?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ): Promise<{ configured: boolean; area: string | null; places: NaverPlace[] }> {
    if (!this.naver.configured) return { configured: false, area: null, places: [] };
    const base = query?.trim() || "맛집";
    const latN = Number(lat);
    const lngN = Number(lng);
    const area =
      Number.isFinite(latN) && Number.isFinite(lngN) && lat && lng
        ? await this.naver.reverseArea(latN, lngN)
        : null;
    const places = await this.collect(area, base);
    return { configured: true, area, places };
  }

  /** 동네 이름으로 좌표 찾기 — 맛집 탭의 "위치 지정"에서 쓴다(네이버 키와 무관, 항상 동작). */
  @Get("areas")
  async areas(@Query("query") query?: string): Promise<{ areas: AreaHit[] }> {
    if (!query?.trim()) return { areas: [] };
    return { areas: await this.naver.searchAreas(query) };
  }

  /**
   * 네이버 지역검색은 요청당 최대 5건(start 페이징도 없음)이라 한 번 부르면 목록이 반쪽이 된다.
   * 정렬·질의를 달리한 여러 요청을 병렬로 던져 합치고 중복을 제거한다. 일부 요청이 실패해도
   * 나머지 결과로 화면을 채운다.
   */
  private async collect(area: string | null, base: string): Promise<NaverPlace[]> {
    const q = (extra?: string) =>
      [area, base, extra].filter(Boolean).join(" ").trim() || base;
    const variants: { query: string; sort: "random" | "comment" }[] = [
      { query: q(), sort: "random" },
      { query: q(), sort: "comment" },
      { query: q("추천"), sort: "comment" },
    ];
    const settled = await Promise.allSettled(
      variants.map((v) => this.naver.searchLocal(v.query, 5, v.sort)),
    );
    const ok = settled.filter((r) => r.status === "fulfilled");
    // 전부 실패면 원래대로 에러를 올린다(빈 목록으로 위장하지 않는다).
    if (ok.length === 0) {
      const first = settled[0];
      throw first.status === "rejected" ? first.reason : new Error("naver search failed");
    }
    const seen = new Set<string>();
    const merged: NaverPlace[] = [];
    for (const r of ok) {
      for (const p of (r as PromiseFulfilledResult<NaverPlace[]>).value) {
        const key = `${p.title}|${p.roadAddress || p.address}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(p);
      }
    }
    return merged;
  }
}
