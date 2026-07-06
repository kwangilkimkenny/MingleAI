import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";
import { MatchModule } from "../match/match.module";
import { MessengerService } from "./messenger.service";
import { MessengerController } from "./messenger.controller";
import { MESSENGER_EMITTER } from "./messenger.emitter";

@Module({
  imports: [PrismaModule, SafetyModule, NotificationModule, MatchModule],
  controllers: [MessengerController],
  providers: [
    MessengerService,
    // Placeholder no-op emitter — Task 6 replaces this with the real gateway
    { provide: MESSENGER_EMITTER, useValue: { emitNewMessage() {}, emitRead() {} } },
  ],
  exports: [MessengerService, MESSENGER_EMITTER],
})
export class MessengerModule {}
