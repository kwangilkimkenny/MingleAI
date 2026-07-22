import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

export interface DevIdentityPayload {
  name: string;
  birth: string; // YYYY-MM-DD
  gender: string; // male | female
  phone: string;
}

/** Real-name identity verification (본인인증). The real provider (NICE/PASS/KG이니시스 등) is wired
 *  during credential setup; until then a dev bypass (IDENTITY_DEV_BYPASS) accepts a test identity so
 *  the gate flow is testable. Verified gender/birth become the authoritative profile values. */
@Injectable()
export class IdentityService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private devBypass(): boolean {
    return this.config.get("IDENTITY_DEV_BYPASS") === "true";
  }

  /** Begin verification. Dev bypass returns a marker; real flow returns a provider redirect. */
  async start(): Promise<{ mode: "dev" | "redirect"; redirectUrl?: string }> {
    if (this.devBypass()) return { mode: "dev" };
    throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");
  }

  /** Complete verification: persist the verified identity, enforce one-account-per-person via CI,
   *  and reflect gender/age into the profile. */
  async complete(userId: string, payload: DevIdentityPayload): Promise<{ ok: true }> {
    if (!this.devBypass()) throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");

    const gender = payload.gender === "female" ? "female" : "male";
    const birth = new Date(payload.birth);
    const ci = this.devHash("ci", payload.phone);
    const di = this.devHash("di", payload.phone);

    const dupe = await this.prisma.user.findFirst({
      where: { identityCi: ci, NOT: { id: userId } },
      select: { id: true },
    });
    if (dupe) throw new ConflictException("이미 인증된 다른 계정이 있습니다");

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phoneNumber: payload.phone,
          phoneVerifiedAt: new Date(),
          identityCi: ci,
          identityDi: di,
          verifiedName: payload.name,
          verifiedBirth: birth,
          verifiedGender: gender,
        },
      });
    } catch (e) {
      // unique(identity_ci) race → the other writer already claimed this person
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException("이미 인증된 다른 계정이 있습니다");
      throw e;
    }

    // Verified identity is authoritative — overwrite self-reported gender/age if a profile exists.
    const profile = await this.prisma.profile.findFirst({ where: { userId }, select: { id: true } });
    if (profile) {
      await this.prisma.profile.update({
        where: { id: profile.id },
        data: { gender, age: this.ageFrom(birth) },
      });
    }
    return { ok: true };
  }

  private ageFrom(birth: Date): number {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }

  /** Deterministic dev-only CI/DI so re-verifying the same phone collides (dup detection works). */
  private devHash(kind: string, phone: string): string {
    return createHash("sha256").update(`${kind}:${phone}`).digest("hex");
  }
}
