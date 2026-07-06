import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";
import { MatchModule } from "../match/match.module";
import { ProposalService } from "./proposal.service";
import { ProposalController } from "./proposal.controller";

@Module({
  imports: [PrismaModule, SafetyModule, NotificationModule, MatchModule],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
