import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingSweepService } from "./matchmaking.sweep";
import { MatchmakingConfigProvider } from "./matchmaking.config";

@Module({
  imports: [PrismaModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingSweepService, MatchmakingConfigProvider],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
