import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(profileId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }

    const [
      completedParties,
      unreadNotifications,
    ] = await Promise.all([
      // 종료된 파티 수
      this.prisma.partyParticipant.count({
        where: {
          profileId,
          party: { status: "ended" },
        },
      }),
      // 읽지 않은 알림 수
      this.prisma.notification.count({
        where: { userId: profile.userId, read: false },
      }),
    ]);

    return {
      profileId,
      completedParties,
      unreadNotifications,
    };
  }

  async getMyParties(profileId: string, limit = 10, offset = 0) {
    const [parties, total] = await Promise.all([
      this.prisma.partyParticipant.findMany({
        where: { profileId },
        include: {
          party: {
            include: { _count: { select: { participants: true } } },
          },
        },
        orderBy: { joinedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.partyParticipant.count({ where: { profileId } }),
    ]);

    return {
      parties: parties.map((p) => ({
        ...p.party,
        participantCount: p.party._count.participants,
        _count: undefined,
        joinedAt: p.joinedAt,
      })),
      total,
      limit,
      offset,
    };
  }
}
