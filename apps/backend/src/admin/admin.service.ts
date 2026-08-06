import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** 신고 목록/상세에 노출하는 최소 프로필 투영 — userId/riskScore 등 민감 필드는 제외. */
function toReportPeer(profile: { id: string; name: string; age: number; gender: string }) {
  return {
    profileId: profile.id,
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
  };
}

export interface AdminStatsResult {
  totalUsers: number;
  activeUsers: number;
  pendingReports: number;
}

export interface ListUsersOptions {
  status?: string;
  search?: string;
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
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.profile.count({ where: { status: "active" } }),
      this.prisma.safetyReport.count({ where: { status: "pending" } }),
    ]);

    return {
      totalUsers,
      activeUsers,
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
        include: { profile: true },
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
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            occupation: true,
            bio: true,
            location: true,
            photoUrl: true,
            status: true,
            riskScore: true,
            createdAt: true,
            updatedAt: true,
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
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            data: true,
            read: true,
            createdAt: true,
          },
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

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: user.profile!.id },
        data: { status },
      });
      if (status !== "active") {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return profile;
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
    await this.prisma.$transaction([
      this.prisma.profile.updateMany({
        where: { userId },
        data: { status: "deleted" },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
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
        reporter: toReportPeer(r.reporter),
        reported: toReportPeer(r.reported),
      })),
      total,
      limit,
      offset,
    };
  }

  async getSafetyReportDetail(reportId: string) {
    const report = await this.prisma.safetyReport.findUnique({
      where: { id: reportId },
      include: { reporter: true, reported: true },
    });

    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다");
    }

    const reportsAgainstReported = await this.prisma.safetyReport.count({
      where: { reportedProfileId: report.reportedProfileId },
    });

    return {
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
      reporter: toReportPeer(report.reporter),
      reported: {
        ...toReportPeer(report.reported),
        status: report.reported.status,
      },
      // 피신고자가 받은 누적 신고 수(현재 신고 포함) — 반복 가해 판단용.
      reportsAgainstReported,
    };
  }

  /** 정지·차단된 프로필을 다시 활성화(계정 복구). */
  async reinstateProfile(profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    return this.prisma.profile.update({
      where: { id: profileId },
      data: { status: "active" },
    });
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

    const updatedReport = await this.prisma.safetyReport.update({
      where: { id: reportId },
      data: { status: resolution.status },
    });

    if (resolution.action && resolution.action !== "none") {
      let profileStatus = "active";
      if (resolution.action === "suspend") {
        profileStatus = "suspended";
      } else if (resolution.action === "ban") {
        profileStatus = "banned";
      }

      if (profileStatus !== "active") {
        await this.prisma.$transaction([
          this.prisma.profile.update({
            where: { id: report.reportedProfileId },
            data: { status: profileStatus },
          }),
          this.prisma.refreshToken.updateMany({
            where: { userId: report.reported.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]);
      }
    }

    return updatedReport;
  }
}
