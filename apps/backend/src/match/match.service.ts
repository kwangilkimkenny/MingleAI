import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { SafetyService } from "../safety/safety.service";
import { normalizeMatchPair, blockPairKey, type MatchSummary, type PeerProfile } from "@mingle/shared";

@Injectable()
export class MatchService {
  private readonly log = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly safety: SafetyService,
  ) {}

  /**
   * Create a Match + DM room directly from two profiles (no proposal) — used by the blind
   * speed date's mutual-choice resolution. Idempotent via the same upsert-on-@@unique pattern
   * (avoids the tx-abort-on-unique-violation bug). Returns null if the pair
   * is blocked (either direction). `match_made` notification is non-fatal and only fires on
   * first creation.
   */
  async createMatch(
    profileAId: string,
    profileBId: string,
  ): Promise<{ matchId: string; roomId: string } | null> {
    if (profileAId === profileBId) return null;
    if (await this.safety.isBlockedBetween(profileAId, profileBId)) return null;
    const [profileId1, profileId2] = normalizeMatchPair(profileAId, profileBId);

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const out = await this.prisma.$transaction(
          async (tx) => {
            const prior = await tx.match.findUnique({
              where: { profileId1_profileId2: { profileId1, profileId2 } },
            });
            const match = await tx.match.upsert({
              where: { profileId1_profileId2: { profileId1, profileId2 } },
              create: { profileId1, profileId2 },
              update: {},
            });
            const room = await tx.directMessageRoom.upsert({
              where: { matchId: match.id },
              create: { matchId: match.id },
              update: {},
            });
            return { matchId: match.id, roomId: room.id, isNew: !prior };
          },
          { isolationLevel: "Serializable" },
        );

        if (out.isNew) {
          try {
            for (const pid of [profileId1, profileId2]) {
              const prof = await this.prisma.profile.findUnique({ where: { id: pid } });
              if (prof)
                await this.notifications.create({
                  userId: prof.userId,
                  type: "match_made",
                  title: "매칭 성사",
                  message: "블라인드 데이트에서 새로운 매칭이 성사되었습니다.",
                  data: { matchId: out.matchId, roomId: out.roomId },
                });
            }
          } catch (notifyErr) {
            this.log.warn(`match_made notification failed for match ${out.matchId}: ${notifyErr}`);
          }
        }
        return { matchId: out.matchId, roomId: out.roomId };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && attempt < MAX_ATTEMPTS)
          continue;
        throw e;
      }
    }
  }

  async listMyMatches(userId: string): Promise<MatchSummary[]> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");
    const matches = await this.prisma.match.findMany({
      where: { OR: [{ profileId1: me.id }, { profileId2: me.id }] },
      include: {
        room: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
        profile1: true,
        profile2: true,
      },
    });
    const summaries: MatchSummary[] = [];
    for (const match of matches) {
      if (!match.room) continue;
      const peerRow = match.profileId1 === me.id ? match.profile2 : match.profile1;
      const unreadCount = await this.prisma.directMessage.count({
        where: { roomId: match.room.id, senderProfileId: { not: me.id }, readAt: null },
      });
      summaries.push({
        matchId: match.id,
        roomId: match.room.id,
        peer: this.toPeer(peerRow),
        lastMessage: match.room.messages[0]
          ? {
              ...match.room.messages[0],
              createdAt: match.room.messages[0].createdAt.toISOString(),
              readAt: match.room.messages[0].readAt?.toISOString() ?? null,
            }
          : undefined,
        unreadCount,
      });
    }
    // Hide rooms whose peer is blocked (either direction) — spec §4.3/§6. Match/room rows are retained.
    const blocked = await this.safety.blocksForProfiles([me.id, ...summaries.map((s) => s.peer.profileId)]);
    return summaries.filter((s) => !blocked.has(blockPairKey(me.id, s.peer.profileId)));
  }

  private toPeer(p: {
    id: string;
    name: string;
    age: number;
    gender: string;
    occupation: string;
    photoUrl: string | null;
    preferenceSignals: unknown;
  }): PeerProfile {
    return {
      profileId: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      photoUrl: p.photoUrl ?? undefined,
      preferenceSummary: (p.preferenceSignals as { summary?: string } | null)?.summary ?? undefined,
    };
  }
}
