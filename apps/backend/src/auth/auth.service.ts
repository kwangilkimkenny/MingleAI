import {
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { AccountAccessService } from "./account-access.service";

const ACCESS_TOKEN_SECONDS = 60 * 60;
const DEFAULT_REFRESH_DAYS = 30;

/**
 * Session core: issues/refreshes/revokes tokens and deletes accounts. Consumer auth is
 * social-only (see SocialAuthService) — there is no email/password path. `devLogin` is a
 * dev/CI/admin bypass, gated by the controller on DEV_AUTH_ENABLED.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  /** Dev/CI/admin login: find-or-create a user by email and issue a session. Never enabled in prod. */
  async devLogin(email: string, role?: string) {
    const normalizedEmail = this.normalizeEmail(email);
    let user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { email: normalizedEmail, authProvider: "dev", role: role ?? "user" },
      });
    } else if (role && user.role !== role) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { role } });
    }
    return this.issueSession(user.id, user.email, user.role);
  }

  /**
   * Admin console login (prod-capable). Gated on ADMIN_EMAIL + ADMIN_PASSWORD_HASH (bcrypt) env —
   * if either is unset the feature is disabled (501). Verifies both fields before issuing, and never
   * reveals which one was wrong (single generic 401). On success, upserts a durable
   * (authProvider="admin", providerId=email) identity with role="admin" and reuses issueSession.
   */
  async adminLogin(email: string, password: string) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminEmail || !passwordHash) {
      throw new NotImplementedException("관리자 로그인이 비활성화되어 있습니다");
    }

    const normalizedEmail = this.normalizeEmail(email);
    const emailOk = normalizedEmail === this.normalizeEmail(adminEmail);
    // Always run the hash comparison so timing does not leak whether the email matched.
    const passwordOk = await bcrypt.compare(password ?? "", passwordHash);
    if (!emailOk || !passwordOk) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다");
    }

    const user = await this.findOrCreateAdmin(normalizedEmail);
    return this.issueSession(user.id, user.email, user.role);
  }

  private async findOrCreateAdmin(normalizedEmail: string) {
    const existing = await this.prisma.user.findUnique({
      where: { authProvider_providerId: { authProvider: "admin", providerId: normalizedEmail } },
    });
    if (existing) {
      if (existing.role === "admin" || existing.role === "super_admin") return existing;
      return this.prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
    }
    // email is unique — only attach it if free so we never collide with an existing account.
    let email: string | null = normalizedEmail;
    if (await this.prisma.user.findUnique({ where: { email } })) email = null;
    return this.prisma.user.create({
      data: { authProvider: "admin", providerId: normalizedEmail, email, role: "admin" },
    });
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: { select: { status: true } } } } },
    });
    if (!existing) throw new UnauthorizedException("유효하지 않은 세션입니다");

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("재사용된 세션입니다. 다시 로그인해 주세요");
    }
    if (existing.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("세션이 만료되었습니다. 다시 로그인해 주세요");
    }
    if (existing.user.profile && existing.user.profile.status !== "active") {
      await this.revokeAll(existing.userId);
      throw new UnauthorizedException("사용할 수 없는 계정입니다");
    }

    const nextRaw = randomBytes(32).toString("base64url");
    const nextHash = this.hashToken(nextRaw);
    const expiresAt = this.refreshExpiry();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.refreshToken.create({
        data: { userId: existing.userId, tokenHash: nextHash, expiresAt },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeAll(existing.userId);
      throw new UnauthorizedException("세션이 이미 갱신되었습니다. 다시 로그인해 주세요");
    }

    return {
      ...this.createAccessToken(existing.user.id, existing.user.email, existing.user.role),
      refreshToken: nextRaw,
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Delete the account. Social-only accounts have no password — a valid session + the typed
   *  "DELETE" confirmation (enforced by the DTO) is the authorization. */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { id: true, photoUrl: true } } },
    });
    if (!user) return;

    const profileId = user.profile?.id;
    await this.prisma.$transaction(async (tx) => {
      if (profileId) {
        await tx.directMessage.deleteMany({ where: { senderProfileId: profileId } });
        await tx.safetyRiskContribution.deleteMany({
          where: { OR: [{ reporterProfileId: profileId }, { reportedProfileId: profileId }] },
        });
        await tx.safetyReport.deleteMany({
          where: { OR: [{ reporterProfileId: profileId }, { reportedProfileId: profileId }] },
        });
        await tx.block.deleteMany({
          where: { OR: [{ blockerProfileId: profileId }, { blockedProfileId: profileId }] },
        });
        await tx.proposal.deleteMany({
          where: { OR: [{ fromProfileId: profileId }, { toProfileId: profileId }] },
        });
        await tx.partyMessage.deleteMany({ where: { profileId } });
        await tx.partyParticipant.deleteMany({ where: { profileId } });
        await tx.matchmakingQueueEntry.deleteMany({ where: { profileId } });
        await tx.speedDateQueueEntry.deleteMany({ where: { profileId } });
        await tx.match.deleteMany({
          where: { OR: [{ profileId1: profileId }, { profileId2: profileId }] },
        });
        await tx.profile.delete({ where: { id: profileId } });
      }
      await tx.notification.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    const localPhoto = this.localUploadFilename(user.profile?.photoUrl);
    if (localPhoto) {
      await unlink(join(process.cwd(), "uploads", localPhoto)).catch(() => undefined);
    }
  }

  /** Issue a fresh access + refresh token pair for an already-authenticated user. */
  async issueSession(userId: string, email: string | null, role: string) {
    await this.accountAccess.requireActive(userId);
    const refreshToken = randomBytes(32).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });
    return { ...this.createAccessToken(userId, email, role), refreshToken };
  }

  private createAccessToken(userId: string, email: string | null, role: string) {
    const payload = { sub: userId, email: email ?? "", role };
    return { accessToken: this.jwtService.sign(payload), expiresIn: ACCESS_TOKEN_SECONDS, role };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshExpiry(): Date {
    const configured = Number(process.env.REFRESH_TOKEN_DAYS ?? DEFAULT_REFRESH_DAYS);
    const days = Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 365) : DEFAULT_REFRESH_DAYS;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private localUploadFilename(photoUrl: string | null | undefined): string | null {
    if (!photoUrl) return null;
    try {
      const filename = basename(new URL(photoUrl).pathname);
      return /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename) ? filename : null;
    } catch {
      return null;
    }
  }
}
