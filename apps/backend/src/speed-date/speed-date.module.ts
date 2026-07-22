import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { MatchModule } from "../match/match.module";
import { SpeedDateConfigProvider } from "./speed-date.config";
import { SpeedDateQueueService } from "./speed-date-queue.service";
import { SpeedDateSessionService } from "./speed-date-session.service";
import { SpeedDateSweepService } from "./speed-date.sweep";
import { LivekitTokenService } from "./livekit-token.service";
import { SpeedDateGateway } from "./speed-date.gateway";
import { SpeedDateController } from "./speed-date.controller";

@Module({
  imports: [AuthModule, PrismaModule, SafetyModule, MatchModule],
  controllers: [SpeedDateController],
  providers: [
    SpeedDateConfigProvider,
    SpeedDateQueueService,
    SpeedDateSessionService,
    SpeedDateSweepService,
    LivekitTokenService,
    SpeedDateGateway,
  ],
  exports: [SpeedDateSessionService],
})
export class SpeedDateModule {}
