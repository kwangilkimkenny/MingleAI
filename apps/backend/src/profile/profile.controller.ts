import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ProfileService } from "./profile.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";

@ApiTags("Profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("profiles")
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.profileService.create(user.userId, dto);
  }

  // ⛔ `GET /profiles`(목록)와 `GET /profiles/:id`(단건)는 2026-08-11 삭제했다.
  // 로그인만 하면 임의 프로필의 닉네임·나이·직업·**사진**을 조회할 수 있어, 스피드데이트 스냅샷의
  // `partner.profileId`와 조합하면 가면 라운드에서 상대 얼굴이 그대로 노출됐다(블라인드 무력화).
  // 어떤 클라이언트도 호출하지 않는 v1 잔재였다. 피어 정보는 매치/DM(`toPeer`)과 세션 스냅샷이
  // 각자 필요한 만큼만 내려준다.

  @Get("me")
  async me(@CurrentUser() user: JwtPayload) {
    const p = await this.profileService.findByUserId(user.userId);
    if (!p) throw new NotFoundException("프로필이 없습니다");
    return p;
  }

  // Deferred Phase-2 backlog item: reanalyze is LLM-backed and expensive — 5/min guard.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post("me/reanalyze")
  @HttpCode(HttpStatus.OK)
  reanalyze(@CurrentUser() user: JwtPayload) {
    return this.profileService.reanalyze(user.userId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.profileService.update(id, user.userId, dto);
  }
}
