import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SafetyService } from "./safety.service";
import { CheckContentDto } from "./dto/check-content.dto";
import { ReportUserDto } from "./dto/report-user.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ProfileService } from "../profile/profile.service";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import type { SafetyContext } from "@mingle/shared";

@ApiTags("Safety")
@Controller("safety")
export class SafetyController {
  constructor(
    private safetyService: SafetyService,
    private profileService: ProfileService,
  ) {}

  @Post("check")
  check(@Body() dto: CheckContentDto) {
    return this.safetyService.checkContent(
      dto.content,
      dto.context as SafetyContext,
    );
  }

  @Post("report")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async report(@CurrentUser() user: JwtPayload, @Body() dto: ReportUserDto) {
    return this.safetyService.reportUser(
      user.userId,
      dto.reportedProfileId,
      dto.reason,
      dto.details,
      dto.evidencePartyId,
    );
  }
}
