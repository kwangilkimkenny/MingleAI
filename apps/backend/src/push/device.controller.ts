import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { SetPushEnabledDto } from "./dto/set-push-enabled.dto";

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DeviceController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("devices")
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId: user.userId, token: dto.token, platform: dto.platform },
      update: { userId: user.userId, platform: dto.platform },
    });
  }

  @Delete("devices/:token")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@CurrentUser() user: JwtPayload, @Param("token") token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId: user.userId } });
  }

  @Patch("users/me/push")
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPush(@CurrentUser() user: JwtPayload, @Body() dto: SetPushEnabledDto) {
    await this.prisma.user.update({ where: { id: user.userId }, data: { pushEnabled: dto.pushEnabled } });
  }
}
