import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DatePlanService } from "./date-plan.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@ApiTags("Date Plans")
@Controller("date-plans")
export class DatePlanController {
  constructor(private datePlanService: DatePlanService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateDatePlanDto) {
    return this.datePlanService.create(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.datePlanService.findOne(id);
  }
}
