import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartyDto } from "./dto/create-party.dto";

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
        orderBy: { scheduledAt: "desc" },
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

  async create(dto: CreatePartyDto) {
    return this.prisma.party.create({
      data: {
        name: dto.name,
        scheduledAt: new Date(dto.scheduledAt),
        maxParticipants: dto.maxParticipants ?? 20,
        theme: dto.theme,
        roundCount: dto.roundCount ?? 3,
        roundDurationMinutes: dto.roundDurationMinutes ?? 10,
      },
    });
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

  async addParticipant(partyId: string, profileId: string) {
    const party = await this.findOne(partyId);
    if (party.status !== "scheduled")
      throw new BadRequestException("참가 등록은 예정된 파티에만 가능합니다");

    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException(`프로필을 찾을 수 없습니다: ${profileId}`);
    if (profile.status !== "active") throw new BadRequestException("활성 상태의 프로필만 참가할 수 있습니다");

    // Serializable 트랜잭션으로 레이스 컨디션 방지 (count-then-create 경쟁 조건)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await this.prisma.$transaction(async (tx: any) => {
        const count = await tx.partyParticipant.count({ where: { partyId } });
        if (count >= party.maxParticipants)
          throw new BadRequestException("파티 인원이 가득 찼습니다");
        await tx.partyParticipant.create({ data: { partyId, profileId } });
        return { participantCount: count + 1 };
      }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034") throw new ConflictException("잠시 후 다시 시도해주세요");
      if (code === "P2002") throw new ConflictException("이미 참가 중인 파티입니다");
      throw e;
    }
  }
}
