import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { SafetyModule } from "../safety/safety.module";
import { MatchService } from "./match.service";

@Module({
  imports: [PrismaModule, NotificationModule, SafetyModule],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
