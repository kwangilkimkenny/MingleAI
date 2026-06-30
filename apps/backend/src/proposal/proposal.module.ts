import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProposalService } from "./proposal.service";

@Module({
  imports: [PrismaModule],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
