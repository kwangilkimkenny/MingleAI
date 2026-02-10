import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AdminStatsResult {
  totalUsers: number;
  activeUsers: number;
  totalParties: number;
  scheduledParties: number;
  completedParties: number;
  totalReservations: number;
  pendingReports: number;
}

export interface ListUsersOptions {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListPartiesOptions {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ListReportsOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats(): Promise<AdminStatsResult> {
    const [
      totalUsers,
      activeUsers,
      totalParties,
      scheduledParties,
      completedParties,
      totalReservations,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({ where: { status: "active" } }),
      this.prisma.party.count(),
      this.prisma.party.count({ where: { status: "scheduled" } }),
      this.prisma.party.count({ where: { status: "completed" } }),
      this.prisma.partyReservation.count({ where: { status: "confirmed" } }),
      this.prisma.safetyReport.count({ where: { status: "pending" } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalParties,
      scheduledParties,
      completedParties,
      totalReservations,
      pendingReports,
    };
  }

  async listUsers(options: ListUsersOptions = {}) {
    const { status, search, limit = 20, offset = 0 } = options;

    const where: {
      profile?: { status: string };
      OR?: Array<{ email?: { contains: string; mode: "insensitive" }; profile?: { name: { contains: string; mode: "insensitive" } } }>;
    } = {};

    if (status) {
      where.profile = { status };
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { profile: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            include: {
              _count: {
                select: {
                  partyParticipants: true,
                  reservations: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        profile: u.profile
          ? {
              id: u.profile.id,
              name: u.profile.name,
              age: u.profile.age,
              gender: u.profile.gender,
              location: u.profile.location,
              status: u.profile.status,
              riskScore: u.profile.riskScore,
              partyCount: u.profile._count.partyParticipants,
              reservationCount: u.profile._count.reservations,
            }
          : null,
      })),
      total,
      limit,
      offset,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            partyParticipants: {
              include: { party: true },
              orderBy: { joinedAt: "desc" },
              take: 10,
            },
            reservations: {
              include: { party: true },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            reportsFiled: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            reportsReceived: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
        notifications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다");
    }

    return user;
  }

  async updateUserStatus(userId: string, status: "active" | "suspended") {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다");
    }

    if (!user.profile) {
      throw new BadRequestException("프로필이 없는 사용자입니다");
    }

    return this.prisma.profile.update({
      where: { id: user.profile.id },
      data: { status },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("사용자를 찾을 수 없습니다");
    }

    // 프로필 상태를 deleted로 변경 (소프트 삭제)
    if (user) {
      await this.prisma.profile.updateMany({
        where: { userId },
        data: { status: "deleted" },
      });
    }

    return { success: true };
  }

  async listParties(options: ListPartiesOptions = {}) {
    const { status, dateFrom, dateTo, limit = 20, offset = 0 } = options;

    const where: {
      status?: string;
      scheduledAt?: { gte?: Date; lte?: Date };
    } = {};

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.scheduledAt = {};
      if (dateFrom) {
        where.scheduledAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.scheduledAt.lte = new Date(dateTo);
      }
    }

    const [parties, total] = await Promise.all([
      this.prisma.party.findMany({
        where,
        include: {
          _count: {
            select: {
              participants: true,
              reservations: true,
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.party.count({ where }),
    ]);

    return {
      parties: parties.map((p) => ({
        ...p,
        participantCount: p._count.participants,
        reservationCount: p._count.reservations,
        _count: undefined,
      })),
      total,
      limit,
      offset,
    };
  }

  async getPartyDetail(partyId: string) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        participants: {
          include: {
            profile: true,
          },
        },
        reservations: {
          include: {
            profile: true,
          },
        },
        reports: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!party) {
      throw new NotFoundException("파티를 찾을 수 없습니다");
    }

    return party;
  }

  async updateParty(
    partyId: string,
    data: {
      name?: string;
      scheduledAt?: string;
      maxParticipants?: number;
      theme?: string;
      location?: string;
      ageMin?: number;
      ageMax?: number;
      status?: string;
    },
  ) {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
    });

    if (!party) {
      throw new NotFoundException("파티를 찾을 수 없습니다");
    }

    const updateData: {
      name?: string;
      scheduledAt?: Date;
      maxParticipants?: number;
      theme?: string;
      location?: string;
      ageMin?: number;
      ageMax?: number;
      status?: string;
    } = {};

    if (data.name) updateData.name = data.name;
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.maxParticipants) updateData.maxParticipants = data.maxParticipants;
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.ageMin !== undefined) updateData.ageMin = data.ageMin;
    if (data.ageMax !== undefined) updateData.ageMax = data.ageMax;
    if (data.status) updateData.status = data.status;

    return this.prisma.party.update({
      where: { id: partyId },
      data: updateData,
    });
  }

  async listSafetyReports(options: ListReportsOptions = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where: { status?: string } = {};
    if (status) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      this.prisma.safetyReport.findMany({
        where,
        include: {
          reporter: true,
          reported: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.safetyReport.count({ where }),
    ]);

    return {
      reports: reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        reporter: {
          id: r.reporter.id,
          name: r.reporter.name,
        },
        reported: {
          id: r.reported.id,
          name: r.reported.name,
        },
      })),
      total,
      limit,
      offset,
    };
  }

  async resolveSafetyReport(
    reportId: string,
    resolution: {
      status: "resolved" | "dismissed";
      action?: "warn" | "suspend" | "ban" | "none";
      notes?: string;
    },
  ) {
    const report = await this.prisma.safetyReport.findUnique({
      where: { id: reportId },
      include: { reported: true },
    });

    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다");
    }

    // 신고 상태 업데이트
    const updatedReport = await this.prisma.safetyReport.update({
      where: { id: reportId },
      data: { status: resolution.status },
    });

    // 조치가 필요한 경우 대상 프로필 상태 변경
    if (resolution.action && resolution.action !== "none") {
      let profileStatus = "active";
      if (resolution.action === "suspend") {
        profileStatus = "suspended";
      } else if (resolution.action === "ban") {
        profileStatus = "banned";
      }

      if (profileStatus !== "active") {
        await this.prisma.profile.update({
          where: { id: report.reportedProfileId },
          data: { status: profileStatus },
        });
      }
    }

    return updatedReport;
  }
}
