import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ReportService } from "./report.service";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("reports")
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Post("generate")
  @UseGuards(JwtAuthGuard)
  generate(@Body() dto: GenerateReportDto) {
    return this.reportService.generate(dto.partyId, dto.profileId, dto.reportType ?? "summary");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.reportService.findOne(id);
  }

  @Get()
  findByProfile(
    @Query("profileId") profileId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.reportService.findByProfile(
      profileId,
      limit ? parseInt(limit, 10) : 10,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
