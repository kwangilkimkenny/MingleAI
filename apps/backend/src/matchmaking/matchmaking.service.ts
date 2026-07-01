import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { MatchmakingQueueEntry, MatchmakingStatus, PublicParty } from "@mingle/shared";

@Injectable()
export class MatchmakingService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(userId: string): Promise<MatchmakingQueueEntry> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    if (!profile.preferenceSignals) throw new BadRequestException("선호 분석이 필요합니다");

    return this.prisma.$transaction(async (tx) => {
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
    });
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
    const entry = await this.prisma.matchmakingQueueEntry.findFirst({
      where: { profileId: profile.id },
      orderBy: { enqueuedAt: "desc" },
    });
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
