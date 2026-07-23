import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NaverSearchService, type NaverPlace } from "./naver-search.service";

@Controller("places")
@UseGuards(JwtAuthGuard)
export class NaverController {
  constructor(private readonly naver: NaverSearchService) {}

  /** Nearby restaurants for the 네이버 예약 tab. Returns an empty list (not an error) when the
   *  Naver key is unset, so the client shows a graceful empty state. */
  @Get("nearby")
  async nearby(@Query("query") query?: string): Promise<{ configured: boolean; places: NaverPlace[] }> {
    if (!this.naver.configured) return { configured: false, places: [] };
    const places = await this.naver.searchLocal(query?.trim() || "맛집", 10);
    return { configured: true, places };
  }
}
