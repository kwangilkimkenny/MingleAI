import { Injectable, NotFoundException } from "@nestjs/common";
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
}
