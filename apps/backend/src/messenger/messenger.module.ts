import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";
import { MatchModule } from "../match/match.module";
import { AuthModule } from "../auth/auth.module";
import { MessengerService } from "./messenger.service";
import { MessengerController } from "./messenger.controller";
import { MessengerGateway } from "./messenger.gateway";
import { MESSENGER_EMITTER } from "./messenger.emitter";

@Module({
  imports: [PrismaModule, SafetyModule, NotificationModule, MatchModule, AuthModule],
  controllers: [MessengerController],
  providers: [
    MessengerService,
    MessengerGateway,
    { provide: MESSENGER_EMITTER, useExisting: MessengerGateway },
  ],
  exports: [MessengerService, MESSENGER_EMITTER],
})
export class MessengerModule {}
