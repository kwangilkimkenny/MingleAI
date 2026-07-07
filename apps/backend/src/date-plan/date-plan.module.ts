import { Module } from "@nestjs/common";
import { DatePlanController } from "./date-plan.controller";
import { DatePlanService } from "./date-plan.service";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [SafetyModule, NotificationModule],
  controllers: [DatePlanController],
  providers: [DatePlanService],
  exports: [DatePlanService],
})
export class DatePlanModule {}
