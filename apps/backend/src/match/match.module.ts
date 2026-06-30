import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchService } from "./match.service";

@Module({
  imports: [PrismaModule],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
