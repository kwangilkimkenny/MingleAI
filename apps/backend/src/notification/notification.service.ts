import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushService } from "../push/push.service";

export interface CreateNotificationDto {
  userId: string;
  type:
    | "party_reminder"
    | "match_result"
    | "reservation"
    | "system"
    | "proposal_received"
    | "match_made"
    | "message_received";
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationService {
  private readonly log = new Logger(NotificationService.name);
  constructor(
    private prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async findAllByUser(userId: string, limit = 50, offset = 0) {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, limit, offset };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unreadCount: count };
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async create(dto: CreateNotificationDto) {
    const row = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data,
      },
    });
    try {
      await this.push.sendToUser(dto.userId, {
        type: dto.type,
        title: dto.title,
        body: dto.message,
        data: dto.data as Record<string, unknown> | undefined,
      });
    } catch (err) {
      this.log.warn(`push notify failed for user ${dto.userId}: ${err}`);
    }
    return row;
  }

  async createMany(dtos: CreateNotificationDto[]) {
    return this.prisma.notification.createMany({
      data: dtos.map((dto) => ({
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data,
      })),
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }
}
