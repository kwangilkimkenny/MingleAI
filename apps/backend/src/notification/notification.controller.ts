import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NotificationService } from "./notification.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "알림 목록 조회" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  findAll(
    @Request() req: { user: { userId: string } },
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.notificationService.findAllByUser(
      req.user.userId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get("unread-count")
  @ApiOperation({ summary: "읽지 않은 알림 수 조회" })
  getUnreadCount(@Request() req: { user: { userId: string } }) {
    return this.notificationService.getUnreadCount(req.user.userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "알림 읽음 처리" })
  markAsRead(
    @Request() req: { user: { userId: string } },
    @Param("id") id: string,
  ) {
    return this.notificationService.markAsRead(id, req.user.userId);
  }

  @Post("read-all")
  @ApiOperation({ summary: "전체 알림 읽음 처리" })
  markAllAsRead(@Request() req: { user: { userId: string } }) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "알림 삭제" })
  delete(
    @Request() req: { user: { userId: string } },
    @Param("id") id: string,
  ) {
    return this.notificationService.delete(id, req.user.userId);
  }
}
