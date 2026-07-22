import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CONSENT_VERSION,
  REQUIRED_CONSENTS,
  type AccountStatus,
  type ConsentScope,
} from "@mingle/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Record consent for the given scopes (must include all required). Idempotent (upsert). */
  async submit(userId: string, scopes: ConsentScope[]): Promise<void> {
    if (!REQUIRED_CONSENTS.every((s) => scopes.includes(s)))
      throw new BadRequestException("모든 필수 동의가 필요합니다");

    for (const scope of scopes) {
      await this.prisma.consentGrant.upsert({
        where: { userId_scope: { userId, scope } },
        create: { userId, scope, version: CONSENT_VERSION },
        update: { version: CONSENT_VERSION, grantedAt: new Date() },
      });
    }
    // Keep the legacy per-user stamps in sync for existing dashboards.
    await this.prisma.user.update({
      where: { id: userId },
      data: { termsAcceptedAt: new Date(), termsVersion: CONSENT_VERSION, privacyVersion: CONSENT_VERSION },
    });
  }

  async getConsents(userId: string): Promise<Record<ConsentScope, boolean>> {
    const rows = await this.prisma.consentGrant.findMany({
      where: { userId },
      select: { scope: true },
    });
    const have = new Set(rows.map((r) => r.scope));
    return { terms: have.has("terms"), privacy: have.has("privacy"), age19: have.has("age19") };
  }

  /** The onboarding-gate status the client uses to decide the next required step. */
  async getAccountStatus(userId: string): Promise<AccountStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authProvider: true, phoneVerifiedAt: true, profile: { select: { id: true } } },
    });
    return {
      provider: (user?.authProvider as AccountStatus["provider"]) ?? "local",
      phoneVerifiedAt: user?.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
      consents: await this.getConsents(userId),
      hasProfile: !!user?.profile,
    };
  }
}
