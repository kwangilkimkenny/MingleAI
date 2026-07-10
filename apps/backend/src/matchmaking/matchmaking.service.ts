import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { MatchmakingQueueEntry, MatchmakingStatus, PublicParty } from "@mingle/shared";

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(userId: string): Promise<MatchmakingQueueEntry> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    if (!profile.preferenceSignals) throw new BadRequestException("선호 분석이 필요합니다");

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const activeMembership = await tx.partyParticipant.findFirst({
              where: { profileId: profile.id, party: { status: { not: "ended" } } },
            });
            if (activeMembership) throw new ConflictException("이미 참여 중인 파티가 있습니다");
            const existing = await tx.matchmakingQueueEntry.findFirst({
              where: { profileId: profile.id, status: "waiting" },
            });
            if (existing) return this.toEntry(existing);
            const entry = await tx.matchmakingQueueEntry.create({
              data: {
                profileId: profile.id,
                status: "waiting",
                preferenceSnapshot: profile.preferenceSignals as object,
              },
            });
            return this.toEntry(entry);
          },
          { isolationLevel: "Serializable" },
        );
      } catch (e) {
        const code = (e as { code?: string }).code;
        // P2034 = serialization/write-conflict; P2002 = a concurrent enqueue won the partial-unique
        // race (matchmaking_queue_entries_profile_waiting_key). Retry: the next attempt finds the
        // now-committed waiting row and returns it (idempotent) — never surfaces a raw 500.
        if ((code === "P2034" || code === "P2002") && attempt < MAX_ATTEMPTS) continue;
        throw e;
      }
    }
  }

  async cancel(userId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    const res = await this.prisma.matchmakingQueueEntry.updateMany({
      where: { profileId: profile.id, status: "waiting" },
      data: { status: "cancelled" },
    });
    if (res.count === 0) throw new NotFoundException("대기 중인 매칭이 없습니다");
  }

  async getStatus(userId: string): Promise<MatchmakingStatus> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return { status: "none" };
    const entry =
      (await this.prisma.matchmakingQueueEntry.findFirst({
        where: { profileId: profile.id, status: { in: ["waiting", "matched"] } },
        orderBy: { enqueuedAt: "desc" },
      })) ??
      (await this.prisma.matchmakingQueueEntry.findFirst({
        where: { profileId: profile.id },
        orderBy: { enqueuedAt: "desc" },
      }));
    if (!entry) return { status: "none" };
    if (entry.status === "waiting") {
      return { status: "waiting", elapsedMs: Date.now() - new Date(entry.enqueuedAt).getTime() };
    }
    if (entry.status === "matched") {
      if (!entry.matchedPartyId) return { status: "matched" };
      const party = await this.loadPublicParty(entry.matchedPartyId);
      return { status: "matched", matchedPartyId: entry.matchedPartyId, party: party ?? undefined };
    }
    return { status: "cancelled" };
  }

  async loadPublicParty(partyId: string): Promise<PublicParty | null> {
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: { participants: { include: { profile: true } } },
    });
    if (!party) return null;
    return {
      id: party.id,
      name: party.name,
      status: party.status,
      participants: party.participants.map((pp) => ({
        profileId: pp.profile.id,
        name: pp.profile.name,
        age: pp.profile.age,
        gender: pp.profile.gender,
        occupation: pp.profile.occupation,
        photoUrl: pp.profile.photoUrl ?? undefined,
        preferenceSummary:
          (pp.profile.preferenceSignals as { summary?: string } | null)?.summary ?? undefined,
      })),
    };
  }

  private toEntry(e: {
    id: string;
    status: string;
    enqueuedAt: Date;
    matchedPartyId: string | null;
  }): MatchmakingQueueEntry {
    return {
      id: e.id,
      status: e.status as "waiting" | "matched" | "cancelled",
      enqueuedAt: new Date(e.enqueuedAt).toISOString(),
      matchedPartyId: e.matchedPartyId,
    };
  }
}
