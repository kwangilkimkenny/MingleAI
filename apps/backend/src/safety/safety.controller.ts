import {
  Controller,
  Post,
  Body,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
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
    const profile = await this.profileService.findByUserId(user.userId);
    if (!profile) {
      throw new NotFoundException("신고자의 프로필을 찾을 수 없습니다");
    }
    return this.safetyService.reportUser(
      profile.id,
      dto.reportedProfileId,
      dto.reason,
      dto.details,
      dto.evidencePartyId,
    );
  }
}
