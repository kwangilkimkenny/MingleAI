import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { normalizeMatchPair } from "@mingle/shared";

@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
  ) {}

  private windowHours(): number {
    const n = Number(this.config.get("PROPOSAL_WINDOW_HOURS"));
    return Number.isFinite(n) && n > 0 ? n : 24;
  }

  private maxPerParty(): number {
    const n = Number(this.config.get("PROPOSAL_MAX_PER_PARTY"));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
  }

  private async profileId(userId: string): Promise<string> {
    const p = await this.prisma.profile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException("프로필이 없습니다");
    return p.id;
  }

  async send(userId: string, partyId: string, toProfileId: string) {
    const from = await this.profileId(userId);
    if (from === toProfileId) throw new BadRequestException("자기 자신에게는 프로포즈할 수 없습니다");

    // eligible party: status active, OR ended within the window, AND caller is a participant
    const cutoff = new Date(Date.now() - this.windowHours() * 3_600_000);
    const party = await this.prisma.party.findFirst({
      where: {
        id: partyId,
        OR: [{ status: "active" }, { status: "ended", endedAt: { gte: cutoff } }],
        participants: { some: { profileId: from } },
      },
    });
    if (!party) throw new ForbiddenException("이 파티에서는 프로포즈할 수 없습니다");

    // both must be participants
    const bothIn = await this.prisma.partyParticipant.count({
      where: { partyId, profileId: { in: [from, toProfileId] } },
    });
    if (bothIn < 2) throw new ForbiddenException("상대가 이 파티의 참가자가 아닙니다");

    if (await this.safety.isBlockedBetween(from, toProfileId))
      throw new ForbiddenException("차단된 상대입니다");

    const [p1, p2] = normalizeMatchPair(from, toProfileId);
    if (
      await this.prisma.match.findUnique({
        where: { profileId1_profileId2: { profileId1: p1, profileId2: p2 } },
      })
    )
      throw new ConflictException("이미 매칭된 상대입니다");

    const sent = await this.prisma.proposal.count({ where: { partyId, fromProfileId: from } });
    if (sent >= this.maxPerParty()) throw new ConflictException("이 파티의 프로포즈 한도를 초과했습니다");

    if (await this.prisma.proposal.findFirst({ where: { partyId, fromProfileId: from, toProfileId } }))
      throw new ConflictException("이미 프로포즈한 상대입니다");

    const created = await this.prisma.proposal.create({
      data: { partyId, fromProfileId: from, toProfileId, status: "pending" },
    });

    // proposal-received notification (outside any transaction)
    const recipient = await this.prisma.profile.findUnique({ where: { id: toProfileId } });
    if (recipient)
      await this.notifications.create({
        userId: recipient.userId,
        type: "proposal_received",
        title: "새 프로포즈",
        message: "누군가 당신에게 프로포즈했습니다.",
        data: { proposalId: created.id, partyId },
      });

    return created;
  }

  async listReceived(userId: string) {
    const me = await this.profileId(userId);
    return this.prisma.proposal.findMany({
      where: { toProfileId: me, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  async listSent(userId: string) {
    const me = await this.profileId(userId);
    return this.prisma.proposal.findMany({
      where: { fromProfileId: me },
      orderBy: { createdAt: "desc" },
    });
  }

  async decline(userId: string, proposalId: string): Promise<void> {
    const me = await this.profileId(userId);
    const res = await this.prisma.proposal.updateMany({
      where: { id: proposalId, toProfileId: me, status: "pending" },
      data: { status: "declined", respondedAt: new Date() },
    });
    if (res.count === 0) throw new NotFoundException("응답할 프로포즈가 없습니다");
    // NB: no notification to the sender — protects the recipient
  }
}
