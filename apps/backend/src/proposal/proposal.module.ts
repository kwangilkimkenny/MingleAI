import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";
import { ProposalService } from "./proposal.service";
import { ProposalController } from "./proposal.controller";

@Module({
  imports: [PrismaModule, SafetyModule, NotificationModule],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
