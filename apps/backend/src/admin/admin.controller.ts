import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AdminGuard } from "./guards/admin.guard";
import { AdminService } from "./admin.service";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UpdatePartyDto } from "./dto/update-party.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "관리자 대시보드 통계" })
  getStats() {
    return this.adminService.getStats();
  }

  // 사용자 관리
  @Get("users")
  @ApiOperation({ summary: "사용자 목록" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  listUsers(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.listUsers({
      status,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("users/:id")
  @ApiOperation({ summary: "사용자 상세" })
  getUserDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch("users/:id/status")
  @ApiOperation({ summary: "사용자 상태 변경" })
  updateUserStatus(
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto.status);
  }

  @Delete("users/:id")
  @ApiOperation({ summary: "사용자 삭제 (소프트)" })
  deleteUser(@Param("id") id: string) {
    return this.adminService.deleteUser(id);
  }

  // 파티 관리
  @Get("parties")
  @ApiOperation({ summary: "파티 목록" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  listParties(
    @Query("status") status?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.listParties({
      status,
      dateFrom,
      dateTo,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("parties/:id")
  @ApiOperation({ summary: "파티 상세" })
  getPartyDetail(@Param("id") id: string) {
    return this.adminService.getPartyDetail(id);
  }

  @Patch("parties/:id")
  @ApiOperation({ summary: "파티 수정" })
  updateParty(@Param("id") id: string, @Body() dto: UpdatePartyDto) {
    return this.adminService.updateParty(id, dto);
  }

  // 신고 관리
  @Get("safety-reports")
  @ApiOperation({ summary: "신고 목록" })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  listSafetyReports(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.adminService.listSafetyReports({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post("safety-reports/:id/resolve")
  @ApiOperation({ summary: "신고 처리" })
  resolveSafetyReport(
    @Param("id") id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.resolveSafetyReport(id, dto);
  }
}
