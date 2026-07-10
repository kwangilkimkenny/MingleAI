import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";
import { ProfileService } from "../profile/profile.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private profileService: ProfileService,
  ) {}

  /**
   * Resolve the caller's OWN profileId from the JWT. The `profileId` query param is no longer
   * trusted as identity (IDOR fix): if provided it must match the caller's own profile, else 403.
   */
  private async ownProfileId(user: JwtPayload, requested?: string): Promise<string> {
    const profile = await this.profileService.findByUserId(user.userId);
    if (!profile) throw new NotFoundException("프로필을 찾을 수 없습니다");
    if (requested && requested !== profile.id) {
      throw new ForbiddenException("본인의 대시보드만 조회할 수 있습니다");
    }
    return profile.id;
  }

  @Get("summary")
  @ApiOperation({ summary: "대시보드 요약" })
  @ApiQuery({ name: "profileId", required: false })
  async getSummary(
    @CurrentUser() user: JwtPayload,
    @Query("profileId") profileId?: string,
  ) {
    return this.dashboardService.getSummary(await this.ownProfileId(user, profileId));
  }

  @Get("my-parties")
  @ApiOperation({ summary: "내 파티 목록" })
  @ApiQuery({ name: "profileId", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  async getMyParties(
    @CurrentUser() user: JwtPayload,
    @Query("profileId") profileId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const id = await this.ownProfileId(user, profileId);
    return this.dashboardService.getMyParties(
      id,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }
}
