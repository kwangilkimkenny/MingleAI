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

    const now = new Date();

    // 병렬로 여러 쿼리 실행
    const [
      upcomingReservations,
      completedParties,
      totalMatches,
      unreadNotifications,
    ] = await Promise.all([
      // 다가오는 예약 수
      this.prisma.partyReservation.count({
        where: {
          profileId,
          status: "confirmed",
          party: {
            scheduledAt: { gte: now },
            status: "scheduled",
          },
        },
      }),
      // 완료된 파티 수
      this.prisma.partyParticipant.count({
        where: {
          profileId,
          party: { status: "completed" },
        },
      }),
      // 총 매칭 결과 수
      this.prisma.report.count({
        where: { profileId },
      }),
      // 읽지 않은 알림 수
      this.prisma.notification.count({
        where: { userId: profile.userId, read: false },
      }),
    ]);

    return {
      profileId,
      upcomingReservations,
      completedParties,
      totalMatches,
      unreadNotifications,
    };
  }

  async getMyParties(profileId: string, limit = 10, offset = 0) {
    const now = new Date();

    const [parties, total] = await Promise.all([
      this.prisma.partyParticipant.findMany({
        where: { profileId },
        include: {
          party: {
            include: { _count: { select: { participants: true } } },
          },
        },
        orderBy: { party: { scheduledAt: "desc" } },
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
        isUpcoming: p.party.scheduledAt > now,
      })),
      total,
      limit,
      offset,
    };
  }

  async getMyReservations(profileId: string, status?: string, limit = 10, offset = 0) {
    const where: { profileId: string; status?: string } = { profileId };
    if (status) {
      where.status = status;
    }

    const [reservations, total] = await Promise.all([
      this.prisma.partyReservation.findMany({
        where,
        include: {
          party: {
            include: { _count: { select: { reservations: true } } },
          },
        },
        orderBy: { party: { scheduledAt: "desc" } },
        take: limit,
        skip: offset,
      }),
      this.prisma.partyReservation.count({ where }),
    ]);

    return {
      reservations: reservations.map((r) => ({
        ...r,
        party: {
          ...r.party,
          participantCount: r.party._count.reservations,
          _count: undefined,
        },
      })),
      total,
      limit,
      offset,
    };
  }

  async getMyMatches(profileId: string, limit = 10, offset = 0) {
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { profileId },
        include: {
          party: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.report.count({ where: { profileId } }),
    ]);

    return {
      matches: reports.map((r) => ({
        id: r.id,
        partyId: r.partyId,
        partyName: r.party.name,
        reportType: r.reportType,
        matchScores: r.matchScores,
        highlights: r.highlights,
        recommendations: r.recommendations,
        createdAt: r.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }
}
