import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { IdentityStart, VerifiedIdentity } from "./identity-provider";

export interface DevIdentityPayload {
  name: string;
  birth: string; // YYYY-MM-DD
  gender: string; // male | female
  phone: string;
}

/**
 * 실명 본인인증. 공급자(NICE / dev bypass)가 무엇이든 이 서비스의 일은 같다 —
 * **공급자 서버에서 다시 읽은** 신원만 저장하고, CI로 1인 1계정을 강제하고, 나이·성별을
 * 프로필의 권위값으로 반영한다. 앱이 보낸 이름·생년월일은 절대 신뢰하지 않는다.
 *
 * 공급자별 프로토콜은 `identity-provider.ts` 경계 뒤에 둔다. NICE 구현은 계약 후 추가한다.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private devBypass(): boolean {
    return this.config.get("IDENTITY_DEV_BYPASS") === "true";
  }

  /** Dev builds may begin the manual bypass; production stays closed until NICE is implemented. */
  async start(userId: string): Promise<IdentityStart> {
    if (this.devBypass()) return { mode: "dev" };
    // NICE 경로는 계약 대기 중이다. 그전까지 운영에선 시작 자체가 불가능하다 —
    // 반쯤 동작하는 본인인증을 내보내는 것보다 명확히 막는 편이 안전하다.
    void userId;
    throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");
  }

  /** Complete verification: persist the verified identity, enforce one-account-per-person via CI,
   *  and reflect gender/age into the profile. */
  async complete(userId: string, payload: DevIdentityPayload): Promise<{ ok: true }> {
    if (!this.devBypass()) throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");

    const identity: VerifiedIdentity = {
      name: payload.name,
      birth: payload.birth,
      gender: payload.gender === "female" ? "female" : "male",
      phone: payload.phone,
      ci: this.devHash("ci", payload.phone),
      di: this.devHash("di", payload.phone),
    };
    return this.persistVerifiedIdentity(userId, identity);
  }

  private async persistVerifiedIdentity(userId: string, identity: VerifiedIdentity): Promise<{ ok: true }> {
    const birth = new Date(identity.birth);
    if (Number.isNaN(birth.getTime())) throw new BadRequestException("생년월일 정보가 올바르지 않습니다");
    // 만 19세 미만 차단 — 나이 보장은 체크박스가 아니라 본인인증이 한다(2026-07-27).
    if (this.ageFrom(birth) < 19) {
      throw new ForbiddenException("만 19세 이상만 이용할 수 있습니다");
    }

    const dupe = await this.prisma.user.findFirst({
      where: { identityCi: identity.ci, NOT: { id: userId } },
      select: { id: true },
    });
    if (dupe) throw new ConflictException("이미 인증된 다른 계정이 있습니다");

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          phoneNumber: identity.phone,
          phoneVerifiedAt: new Date(),
          identityCi: identity.ci,
          identityDi: identity.di ?? null,
          verifiedName: identity.name,
          verifiedBirth: birth,
          verifiedGender: identity.gender,
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
        data: { gender: identity.gender, age: this.ageFrom(birth) },
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
