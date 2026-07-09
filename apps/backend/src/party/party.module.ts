import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PartyController } from "./party.controller";
import { PartyService } from "./party.service";
import { PartyGateway } from "./party.gateway";
import { GameService } from "./game.service";

@Module({
  imports: [AuthModule],
  controllers: [PartyController],
  providers: [PartyService, PartyGateway, GameService],
  exports: [PartyService],
})
export class PartyModule {}
