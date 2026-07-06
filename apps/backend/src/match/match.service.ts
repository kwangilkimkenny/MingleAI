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

  async acceptProposal(userId: string, proposalId: string): Promise<{ matchId: string; roomId: string }> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const out = await this.prisma.$transaction(
          async (tx) => {
            const guarded = await tx.proposal.updateMany({
              where: { id: proposalId, toProfileId: me.id, status: "pending" },
              data: { status: "accepted", respondedAt: new Date() },
            });
            if (guarded.count === 0) throw new NotFoundException("응답할 프로포즈가 없습니다");
            const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
            if (!proposal) throw new NotFoundException("프로포즈를 찾을 수 없습니다");

            const [profileId1, profileId2] = normalizeMatchPair(proposal.fromProfileId, proposal.toProfileId);
            // FIX 1: upsert avoids the tx-abort bug — a failed INSERT (unique violation) in Postgres
            // aborts the whole transaction, making the catch+refetch approach throw 25P02 instead.
            const match = await tx.match.upsert({
              where: { profileId1_profileId2: { profileId1, profileId2 } },
              create: { profileId1, profileId2, partyId: proposal.partyId, proposalId: proposal.id },
              update: {}, // no-op: keeps existing proposalId, avoids @unique conflict on proposalId
            });
            // FIX 2: same pattern for the DM room
            const room = await tx.directMessageRoom.upsert({
              where: { matchId: match.id },
              create: { matchId: match.id },
              update: {},
            });
            return { matchId: match.id, roomId: room.id, profileId1, profileId2 };
          },
          { isolationLevel: "Serializable" },
        );

        // FIX 3: notifications OUTSIDE the transaction — non-fatal; a notification failure must not
        // fail accept (the match is already committed; a retry would 404 on the accepted proposal).
        try {
          for (const pid of [out.profileId1, out.profileId2]) {
            const prof = await this.prisma.profile.findUnique({ where: { id: pid } });
            if (prof)
              await this.notifications.create({
                userId: prof.userId,
                type: "match_made",
                title: "매칭 성사",
                message: "새로운 매칭이 성사되었습니다.",
                data: { matchId: out.matchId, roomId: out.roomId },
              });
          }
        } catch (notifyErr) {
          this.log.warn(`match_made notification failed for match ${out.matchId}: ${notifyErr}`);
        }
        return { matchId: out.matchId, roomId: out.roomId };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && attempt < MAX_ATTEMPTS) continue;
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
