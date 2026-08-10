import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { SpeedDateStatus } from "@mingle/shared";

/** Genders eligible for the v1 hetero 3×3 mode. Non-binary / other = separate future scope. */
const ELIGIBLE_GENDERS = new Set(["male", "female"]);
const MIN_AGE = 19;
const REQUIRED_PARTICIPANTS = 6;

@Injectable()
export class SpeedDateQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    userId: string,
    geo?: { lat?: number; lng?: number; radiusKm?: number },
  ): Promise<{ status: "waiting" }> {
    // Store coords only as a valid pair; a radius with no coords is meaningless and dropped.
    const hasCoords = typeof geo?.lat === "number" && typeof geo?.lng === "number";
    const lat = hasCoords ? geo!.lat! : null;
    const lng = hasCoords ? geo!.lng! : null;
    const radiusKm = hasCoords && typeof geo?.radiusKm === "number" ? geo.radiusKm : null;
    // Consent is captured at signup (the onboarding gate) — no per-session consent required.
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    if (!profile.preferenceSignals) throw new BadRequestException("선호 분석이 필요합니다");
    if (profile.age < MIN_AGE)
      throw new ForbiddenException("만 19세 이상만 이용할 수 있습니다");
    if (!ELIGIBLE_GENDERS.has(profile.gender))
      throw new BadRequestException("이 모드는 현재 남성/여성 매칭만 지원합니다");
    if (await this.findActiveSessionId(profile.id))
      throw new ConflictException("이미 진행 중인 블라인드 데이트가 있습니다");

    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.speedDateQueueEntry.findFirst({
              where: { profileId: profile.id, status: "waiting" },
            });
            if (existing) return;
            await tx.speedDateQueueEntry.create({
              data: {
                profileId: profile.id,
                gender: profile.gender,
                status: "waiting",
                preferenceSnapshot: profile.preferenceSignals as object,
                lat,
                lng,
                radiusKm,
              },
            });
          },
          { isolationLevel: "Serializable" },
        );
        return { status: "waiting" };
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "P2034" || code === "P2002") {
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
            continue;
          }
          throw new ConflictException("대기열이 혼잡합니다. 잠시 후 다시 시도해주세요.");
        }
        throw e;
      }
    }
  }

  async cancel(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    const res = await this.prisma.speedDateQueueEntry.updateMany({
      where: { profileId: profile.id, status: "waiting" },
      data: { status: "cancelled" },
    });
    if (res.count === 0) throw new NotFoundException("대기 중인 매칭이 없습니다");
  }

  async getStatus(userId: string): Promise<SpeedDateStatus> {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return this.emptyStatus("idle");

    const sessionId = await this.findActiveSessionId(profile.id);
    if (sessionId) return { ...this.emptyStatus("matched"), sessionId };

    const entry = await this.prisma.speedDateQueueEntry.findFirst({
      where: { profileId: profile.id, status: "waiting" },
      orderBy: { enqueuedAt: "desc" },
    });
    if (entry) {
      const waitingCount = await this.prisma.speedDateQueueEntry.count({ where: { status: "waiting" } });
      const missing = Math.max(0, REQUIRED_PARTICIPANTS - waitingCount);
      return {
        status: "waiting",
        sessionId: null,
        since: new Date(entry.enqueuedAt).getTime(),
        waitingCount,
        requiredCount: REQUIRED_PARTICIPANTS,
        estimatedWaitMinutes: Math.max(1, missing * 2),
        canWaitInBackground: true,
      };
    }
    return this.emptyStatus("idle");
  }

  private emptyStatus(status: "idle" | "matched"): SpeedDateStatus {
    return {
      status,
      sessionId: null,
      since: null,
      waitingCount: null,
      requiredCount: REQUIRED_PARTICIPANTS,
      estimatedWaitMinutes: null,
      canWaitInBackground: false,
    };
  }

  /** Scan active sessions for this profile (participants live in state JSON). */
  private async findActiveSessionId(profileId: string): Promise<string | null> {
    const active = await this.prisma.speedDateSession.findMany({
      where: { status: "active" },
      select: { id: true, state: true },
    });
    for (const s of active) {
      const participants = (s.state as { participants?: Array<{ profileId: string }> })?.participants ?? [];
      if (participants.some((p) => p.profileId === profileId)) return s.id;
    }
    return null;
  }
}
