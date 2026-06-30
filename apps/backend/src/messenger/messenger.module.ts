import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MessengerService } from "./messenger.service";

@Module({
  imports: [PrismaModule],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}
