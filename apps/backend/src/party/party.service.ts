import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { PartyMessageView } from "@mingle/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface ListPartiesOptions {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PartyService {
  constructor(private prisma: PrismaService) {}

  async findAll(options: ListPartiesOptions = {}) {
    const { status, search, limit = 20, offset = 0 } = options;
    const where: {
      status?: string;
      name?: { contains: string; mode: "insensitive" };
    } = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const [parties, total] = await Promise.all([
      this.prisma.party.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.party.count({ where }),
    ]);

    return {
      parties: parties.map((p) => ({
        ...p,
        participantCount: p._count.participants,
        _count: undefined,
      })),
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } },
    });
    if (!party) throw new NotFoundException(`파티를 찾을 수 없습니다: ${id}`);
    return {
      ...party,
      participantCount: party._count.participants,
      _count: undefined,
    };
  }

  /** Resolve the caller's profileId iff they are a participant of the party; else null. */
  async assertParticipant(userId: string, partyId: string): Promise<string | null> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) return null;
    const participant = await this.prisma.partyParticipant.findUnique({
      where: { partyId_profileId: { partyId, profileId: me.id } },
    });
    return participant ? me.id : null;
  }

  async addPartyMessage(
    profileId: string,
    partyId: string,
    content: string,
  ): Promise<PartyMessageView> {
    const trimmed = (content ?? "").trim();
    if (!trimmed || trimmed.length > 2000) {
      throw new BadRequestException("메시지는 1~2000자여야 합니다");
    }
    const row = await this.prisma.partyMessage.create({
      data: { partyId, profileId, content: trimmed },
    });
    return this.toMessageView(row);
  }

  async getPartyMessages(partyId: string, limit = 50): Promise<PartyMessageView[]> {
    const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100);
    const rows = await this.prisma.partyMessage.findMany({
      where: { partyId },
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.reverse().map((r) => this.toMessageView(r));
  }

  private toMessageView(row: {
    id: string;
    partyId: string;
    profileId: string;
    content: string;
    createdAt: Date;
  }): PartyMessageView {
    return {
      id: row.id,
      partyId: row.partyId,
      profileId: row.profileId,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
