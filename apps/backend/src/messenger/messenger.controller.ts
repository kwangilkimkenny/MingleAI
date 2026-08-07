import { Controller, Post, Get, Param, Body, Query, ParseIntPipe, DefaultValuePipe, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, type JwtPayload } from "../common/decorators/current-user.decorator";
import { MessengerService } from "./messenger.service";
import { MatchService } from "../match/match.service";
import { SendMessageDto } from "./dto/send-message.dto";

@ApiTags("messenger")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("messenger")
export class MessengerController {
  constructor(
    private readonly messenger: MessengerService,
    private readonly match: MatchService,
  ) {}

  @Get("rooms")
  @ApiOperation({ summary: "내 매치(채팅방) 목록" })
  listRooms(@CurrentUser() user: JwtPayload) {
    return this.match.listMyMatches(user.userId);
  }

  @Get("rooms/:roomId/messages")
  @ApiOperation({ summary: "채팅 히스토리 (cursor 페이지네이션)" })
  @ApiQuery({ name: "before", required: false, description: "ISO timestamp — 이 시각 이전 메시지" })
  @ApiQuery({ name: "limit", required: false, description: "최대 100, 기본 50" })
  history(
    @CurrentUser() user: JwtPayload,
    @Param("roomId") roomId: string,
    @Query("before") before?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.messenger.history(user.userId, roomId, before, limit ?? 50);
  }

  @Post("rooms/:roomId/messages")
  @ApiOperation({ summary: "메시지 전송" })
  send(
    @CurrentUser() user: JwtPayload,
    @Param("roomId") roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messenger.send(user.userId, roomId, dto.content, dto.imageUrl);
  }

  // LLM 호출이라 비싸다 — 분당 10회로 제한(연타로 토큰을 태우지 않게).
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("rooms/:roomId/suggestions")
  @ApiOperation({ summary: "대화 내용 기반 다음 멘트 추천 (LLM, 미설정 시 규칙 폴백)" })
  suggest(@CurrentUser() user: JwtPayload, @Param("roomId") roomId: string) {
    return this.messenger.suggestReplies(user.userId, roomId);
  }

  @Post("rooms/:roomId/read")
  @ApiOperation({ summary: "읽음 처리 (내가 받은 메시지 전체)" })
  markRead(@CurrentUser() user: JwtPayload, @Param("roomId") roomId: string) {
    return this.messenger.markRead(user.userId, roomId);
  }
}
