import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingService } from "./matchmaking.service";

@Module({
  imports: [PrismaModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
