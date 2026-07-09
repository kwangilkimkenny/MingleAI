import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PartyController } from "./party.controller";
import { PartyService } from "./party.service";
import { PartyGateway } from "./party.gateway";

@Module({
  imports: [AuthModule],
  controllers: [PartyController],
  providers: [PartyService, PartyGateway],
  exports: [PartyService],
})
export class PartyModule {}
