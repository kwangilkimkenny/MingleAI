import { Controller, Post, Delete, Get, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { VerifiedGuard } from "../common/guards/verified.guard";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { MatchmakingService } from "./matchmaking.service";

@Controller("matchmaking")
@UseGuards(JwtAuthGuard, VerifiedGuard)
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @Post("queue")
  enqueue(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.enqueue(user.userId);
  }

  @Delete("queue")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.cancel(user.userId);
  }

  @Get("status")
  status(@CurrentUser() user: JwtPayload) {
    return this.matchmaking.getStatus(user.userId);
  }
}
