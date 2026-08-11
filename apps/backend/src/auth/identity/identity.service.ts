import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { IdentityStart, VerifiedIdentity } from "./identity-provider";

export interface DevIdentityPayload {
  name: string;
  birth: string; // YYYY-MM-DD
  gender: string; // male | female
  phone: string;
}

/** @deprecated `IdentityStart`(identity-provider.ts)의 portone 갈래를 쓴다. 기존 호출부 호환용. */
export type PortOneIdentityStart = Extract<IdentityStart, { mode: "portone" }>;

/**
 * 실명 본인인증. 공급자(PortOne / NICE / dev bypass)가 무엇이든 이 서비스의 일은 같다 —
 * **공급자 서버에서 다시 읽은** 신원만 저장하고, CI로 1인 1계정을 강제하고, 나이·성별을
 * 프로필의 권위값으로 반영한다. 앱이 보낸 이름·생년월일은 절대 신뢰하지 않는다.
 *
 * 공급자별 프로토콜은 `identity-provider.ts` seam 뒤에 있다(NICE는 계약 대기 — nice.provider.ts).
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

  /** Begin verification. The signed request id binds the provider result to the authenticated user. */
  async start(userId: string): Promise<IdentityStart> {
    if (this.devBypass()) return { mode: "dev" };
    const storeId = this.config.get<string>("PORTONE_STORE_ID");
    const channelKey = this.config.get<string>("PORTONE_IDENTITY_CHANNEL_KEY");
    if (!storeId || !channelKey || !this.portOneSecret() || !this.stateSecret()) {
      throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");
    }
    return {
      mode: "portone",
      storeId,
      channelKey,
      identityVerificationId: this.createRequestId(userId),
    };
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

  /** Complete a production verification after checking both request ownership and PortOne status. */
  async completePortOne(userId: string, identityVerificationId: string): Promise<{ ok: true }> {
    this.assertRequestOwner(identityVerificationId, userId);
    const apiSecret = this.portOneSecret();
    if (!apiSecret) throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");

    let response: Response;
    try {
      response = await fetch(
        `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
        {
          headers: { Authorization: `PortOne ${apiSecret}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new BadGatewayException("인증기관 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요");
    }
    if (!response.ok) {
      throw new BadGatewayException("인증기관에서 인증 결과를 확인하지 못했습니다");
    }
    const result = (await response.json()) as {
      id?: string;
      status?: string;
      verifiedCustomer?: {
        ci?: string;
        di?: string;
        name?: string;
        birthDate?: string;
        gender?: string;
        phoneNumber?: string;
      };
    };
    if (result.id !== identityVerificationId || result.status !== "VERIFIED") {
      throw new BadRequestException("완료된 본인인증이 아닙니다");
    }
    const customer = result.verifiedCustomer;
    const gender = customer?.gender === "FEMALE" ? "female" : customer?.gender === "MALE" ? "male" : null;
    if (!customer?.ci || !customer.name || !customer.birthDate || !customer.phoneNumber || !gender) {
      throw new BadRequestException("인증기관에서 필수 본인정보를 제공하지 않았습니다");
    }
    return this.persistVerifiedIdentity(userId, {
      name: customer.name,
      birth: customer.birthDate,
      gender,
      phone: customer.phoneNumber,
      ci: customer.ci,
      di: customer.di,
    });
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

  private portOneSecret(): string | undefined {
    return this.config.get<string>("PORTONE_API_SECRET");
  }

  private stateSecret(): string | undefined {
    return this.config.get<string>("PORTONE_IDENTITY_STATE_SECRET");
  }

  private createRequestId(userId: string): string {
    const nonce = randomBytes(12).toString("hex");
    const encodedUser = Buffer.from(userId, "utf8").toString("base64url");
    const body = `${encodedUser}.${nonce}`;
    return `mingles.${body}.${this.sign(body)}`;
  }

  private assertRequestOwner(requestId: string, userId: string): void {
    const parts = requestId.split(".");
    if (parts.length !== 4 || parts[0] !== "mingles") throw new BadRequestException("유효하지 않은 인증 요청입니다");
    const body = `${parts[1]}.${parts[2]}`;
    const expected = this.sign(body);
    const actualBuffer = Buffer.from(parts[3], "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    let requestUser = "";
    try {
      requestUser = Buffer.from(parts[1], "base64url").toString("utf8");
    } catch {
      throw new BadRequestException("유효하지 않은 인증 요청입니다");
    }
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer) ||
      requestUser !== userId
    ) {
      throw new BadRequestException("현재 계정에서 시작한 인증 요청이 아닙니다");
    }
  }

  private sign(body: string): string {
    const secret = this.stateSecret();
    if (!secret) throw new ServiceUnavailableException("본인인증이 현재 구성되지 않았습니다");
    return createHmac("sha256", secret).update(body).digest("base64url").slice(0, 24);
  }
}
