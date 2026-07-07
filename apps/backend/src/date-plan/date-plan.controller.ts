import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { DatePlanService } from "./date-plan.service";
import { CreateDatePlanDto } from "./dto/create-date-plan.dto";
import { SelectCourseDto } from "./dto/select-course.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";

@ApiTags("Date Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("date-plans")
export class DatePlanController {
  constructor(private datePlanService: DatePlanService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDatePlanDto) {
    return this.datePlanService.create(user.userId, dto);
  }

  @Get()
  listForMatch(@CurrentUser() user: JwtPayload, @Query("matchId") matchId: string) {
    return this.datePlanService.listForMatch(user.userId, matchId);
  }

  @Get(":id")
  getOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.getOne(user.userId, id);
  }

  @Patch(":id/select")
  select(@CurrentUser() user: JwtPayload, @Param("id") id: string, @Body() dto: SelectCourseDto) {
    return this.datePlanService.select(user.userId, id, dto.courseId);
  }

  @Patch(":id/confirm")
  confirm(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.confirm(user.userId, id);
  }

  @Patch(":id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.datePlanService.cancel(user.userId, id);
  }
}
