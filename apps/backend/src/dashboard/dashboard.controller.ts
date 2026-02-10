import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get("summary")
  @ApiOperation({ summary: "대시보드 요약" })
  @ApiQuery({ name: "profileId", required: true })
  getSummary(@Query("profileId") profileId: string) {
    return this.dashboardService.getSummary(profileId);
  }

  @Get("my-parties")
  @ApiOperation({ summary: "내 파티 목록" })
  @ApiQuery({ name: "profileId", required: true })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  getMyParties(
    @Query("profileId") profileId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.dashboardService.getMyParties(
      profileId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get("my-reservations")
  @ApiOperation({ summary: "내 예약 목록" })
  @ApiQuery({ name: "profileId", required: true })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  getMyReservations(
    @Query("profileId") profileId: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.dashboardService.getMyReservations(
      profileId,
      status,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get("my-matches")
  @ApiOperation({ summary: "내 매칭 결과" })
  @ApiQuery({ name: "profileId", required: true })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  getMyMatches(
    @Query("profileId") profileId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.dashboardService.getMyMatches(
      profileId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }
}
