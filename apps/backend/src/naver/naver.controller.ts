import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NaverSearchService, type NaverPlace } from "./naver-search.service";

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
    const places = await this.naver.searchLocal(area ? `${area} ${base}` : base, 10);
    return { configured: true, area, places };
  }
}
