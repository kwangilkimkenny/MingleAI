import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingSweepService } from "./matchmaking.sweep";
import { MatchmakingConfigProvider } from "./matchmaking.config";

@Module({
  imports: [PrismaModule, SafetyModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingSweepService, MatchmakingConfigProvider],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
