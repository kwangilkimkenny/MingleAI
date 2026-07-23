import { Controller, Delete, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { VerifiedGuard } from "../common/guards/verified.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { SpeedDateQueueService } from "./speed-date-queue.service";

@Controller("speed-date")
@UseGuards(JwtAuthGuard, VerifiedGuard)
export class SpeedDateController {
  constructor(private readonly queue: SpeedDateQueueService) {}

  // Consent is captured at signup (the onboarding gate); no per-session consent here.
  @Post("queue")
  enqueue(@CurrentUser() user: JwtPayload) {
    return this.queue.enqueue(user.userId);
  }

  @Delete("queue")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@CurrentUser() user: JwtPayload) {
    return this.queue.cancel(user.userId);
  }

  @Get("status")
  status(@CurrentUser() user: JwtPayload) {
    return this.queue.getStatus(user.userId);
  }
}
