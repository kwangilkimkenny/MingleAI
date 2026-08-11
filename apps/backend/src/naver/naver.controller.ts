import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NaverSearchService, type AreaHit, type NaverPlace } from "./naver-search.service";

/**
 * "전체"가 실제로 전체가 되게 하는 업종 세트. 예전에는 전체가 `query=맛집` 한 줄이었는데,
 * 그건 상호·업종에 "맛집"이 걸리는 가게만 잡는 **또 하나의 좁은 카테고리**였다 — 전체(9곳)가
 * 레스토랑(10곳)보다 적게 나왔다(2026-08-11 실측). 이제 업종별로 나눠 던져 합집합을 만든다.
 */
const ALL_TERMS = ["레스토랑", "카페", "와인바", "이자카야", "브런치", "오마카세"] as const;

/** 클라이언트가 "전체"를 뜻할 때 보내는 값들(빈 값 포함). */
const ALL_KEYS = new Set(["", "전체", "맛집"]);

@Controller("places")
@UseGuards(JwtAuthGuard)
export class NaverController {
  constructor(private readonly naver: NaverSearchService) {}

  /** Nearby restaurants for the 예약 탭. Returns an empty list (not an error) when the
   *  Naver key is unset, so the client shows a graceful empty state. When lat/lng are given the
   *  query is prefixed with the reverse-geocoded neighborhood so results are actually nearby.
   *  `depth=2`는 질의 변형을 늘려 목록을 더 채운다("더 보기") — 쿼터를 더 쓰므로 기본은 1. */
  @Get("nearby")
  async nearby(
    @Query("query") query?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("depth") depth?: string,
  ): Promise<{ configured: boolean; area: string | null; places: NaverPlace[] }> {
    if (!this.naver.configured) return { configured: false, area: null, places: [] };
    const base = query?.trim() ?? "";
    const deep = depth === "2";
    const latN = Number(lat);
    const lngN = Number(lng);
    const area =
      Number.isFinite(latN) && Number.isFinite(lngN) && lat && lng
        ? await this.naver.reverseArea(latN, lngN)
        : null;
    const places = ALL_KEYS.has(base)
      ? await this.collectAll(area, deep)
      : await this.collect(area, base, deep);
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
   * 나머지 결과로 화면을 채운다. `deep`이면 수식어를 더 붙여 변형을 3→7개로 늘린다.
   */
  private async collect(area: string | null, base: string, deep = false): Promise<NaverPlace[]> {
    const q = (extra?: string) => [area, base, extra].filter(Boolean).join(" ").trim() || base;
    const variants: { query: string; sort: "random" | "comment" }[] = [
      { query: q(), sort: "random" },
      { query: q(), sort: "comment" },
      { query: q("추천"), sort: "comment" },
    ];
    if (deep) {
      variants.push(
        { query: q("맛집"), sort: "comment" },
        { query: q("데이트"), sort: "comment" },
        { query: q("분위기 좋은"), sort: "comment" },
        { query: q("예약"), sort: "comment" },
      );
    }
    return this.merge(variants);
  }

  /** 전체 = 업종별 질의의 합집합. 업종 하나당 1변형(깊게 보면 2)이라 결과가 한쪽으로 안 쏠린다. */
  private async collectAll(area: string | null, deep = false): Promise<NaverPlace[]> {
    const variants: { query: string; sort: "random" | "comment" }[] = [];
    for (const term of ALL_TERMS) {
      const query = [area, term].filter(Boolean).join(" ").trim() || term;
      variants.push({ query, sort: "comment" });
      if (deep) variants.push({ query, sort: "random" });
    }
    return this.merge(variants);
  }

  /**
   * 변형들을 던져 합치고 (이름|주소)로 중복을 제거한다.
   *
   * ⚠️ 한 번에 다 던지지 않는다. 전체(6질의)·더보기(12질의)를 한꺼번에 병렬로 쏘면 네이버가
   * 429를 뱉고, 실패한 변형이 조용히 빠져 목록이 반토막 난다(2026-08-11 실측: 레스토랑 10곳 → 5곳).
   * 3개씩 끊어 순차로 던지면 지연은 조금 늘지만 결과가 안정된다.
   */
  private async merge(
    variants: { query: string; sort: "random" | "comment" }[],
  ): Promise<NaverPlace[]> {
    const CHUNK = 3;
    const settled: PromiseSettledResult<NaverPlace[]>[] = [];
    for (let i = 0; i < variants.length; i += CHUNK) {
      const batch = variants.slice(i, i + CHUNK);
      settled.push(
        ...(await Promise.allSettled(batch.map((v) => this.naver.searchLocal(v.query, 5, v.sort)))),
      );
    }
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
