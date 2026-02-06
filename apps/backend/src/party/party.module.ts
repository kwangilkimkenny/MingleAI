import { Module } from "@nestjs/common";
import { PartyController } from "./party.controller";
import { PartyService } from "./party.service";
import { PartyGateway } from "./party.gateway";

@Module({
  controllers: [PartyController],
  providers: [PartyService, PartyGateway],
  exports: [PartyService, PartyGateway],
})
export class PartyModule {}
