import { Module } from "@nestjs/common";
import { DatePlanController } from "./date-plan.controller";
import { DatePlanService } from "./date-plan.service";

@Module({
  controllers: [DatePlanController],
  providers: [DatePlanService],
  exports: [DatePlanService],
})
export class DatePlanModule {}
