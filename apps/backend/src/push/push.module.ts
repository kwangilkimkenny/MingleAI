import { Module } from "@nestjs/common";
import { PushService } from "./push.service";
import { DeviceController } from "./device.controller";

@Module({
  controllers: [DeviceController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
