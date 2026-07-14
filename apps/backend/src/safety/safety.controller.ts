import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { SafetyService } from "./safety.service";
import { CheckContentDto } from "./dto/check-content.dto";
import { ReportUserDto } from "./dto/report-user.dto";
import { CreateBlockDto } from "./dto/create-block.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ProfileService } from "../profile/profile.service";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import type { SafetyContext } from "@mingle/shared";

@ApiTags("Safety")
@Controller("safety")
export class SafetyController {
  constructor(
    private safetyService: SafetyService,
    private profileService: ProfileService,
  ) {}

  @Post("check")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  check(@Body() dto: CheckContentDto) {
    return this.safetyService.checkContent(dto.content, dto.context as SafetyContext);
  }

  // Abuse guard: 10 reports/min.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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

  @Post("blocks")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createBlock(@CurrentUser() user: JwtPayload, @Body() dto: CreateBlockDto) {
    const profile = await this.profileService.findByUserId(user.userId);
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    return this.safetyService.createBlock(profile.id, dto.blockedProfileId);
  }

  @Get("blocks")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listBlocks(@CurrentUser() user: JwtPayload) {
    const profile = await this.profileService.findByUserId(user.userId);
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    return this.safetyService.listBlocks(profile.id);
  }

  @Delete("blocks/:blockedProfileId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBlock(@CurrentUser() user: JwtPayload, @Param("blockedProfileId") blocked: string) {
    const profile = await this.profileService.findByUserId(user.userId);
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    await this.safetyService.removeBlock(profile.id, blocked);
  }
}
