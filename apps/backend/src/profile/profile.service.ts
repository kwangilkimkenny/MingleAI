import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import type {
  Gender,
  UserValues,
  CommunicationStyle,
} from "@mingle/shared";

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new BadRequestException("이미 프로필이 존재합니다");
    }

    const agentPersona = this.generateAgentPersona(dto);

    return this.prisma.profile.create({
      data: {
        userId,
        name: dto.name,
        age: dto.age,
        gender: dto.gender,
        location: dto.location,
        occupation: dto.occupation,
        preferences: dto.preferences as object,
        values: dto.values as object,
        communicationStyle: dto.communicationStyle as object,
        bio: dto.bio,
        agentPersona,
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  async findOne(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException(`프로필을 찾을 수 없습니다: ${id}`);
    }
    return profile;
  }

  async findAll(filters?: {
    location?: string;
    ageMin?: number;
    ageMax?: number;
    relationshipGoal?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    const where: Record<string, unknown> = { status: "active" };
    if (filters?.location) {
      where.location = { contains: filters.location, mode: "insensitive" };
    }
    if (filters?.ageMin || filters?.ageMax) {
      where.age = {
        ...(filters?.ageMin ? { gte: filters.ageMin } : {}),
        ...(filters?.ageMax ? { lte: filters.ageMax } : {}),
      };
    }

    const profiles = await this.prisma.profile.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    if (filters?.relationshipGoal) {
      return profiles.filter(
        (p) =>
          (p.values as { relationshipGoal?: string }).relationshipGoal ===
          filters.relationshipGoal,
      );
    }

    return profiles;
  }

  async update(id: string, userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException(`프로필을 찾을 수 없습니다: ${id}`);
    }
    if (profile.userId !== userId) {
      throw new ForbiddenException("본인의 프로필만 수정할 수 있습니다");
    }

    const data: Record<string, unknown> = {};
    if (dto.preferences) data.preferences = dto.preferences as object;
    if (dto.values) data.values = dto.values as object;
    if (dto.communicationStyle)
      data.communicationStyle = dto.communicationStyle as object;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.location !== undefined) data.location = dto.location;

    if (dto.values || dto.communicationStyle) {
      const merged = {
        name: profile.name,
        age: profile.age,
        gender: profile.gender as Gender,
        location: dto.location ?? profile.location,
        occupation: profile.occupation ?? undefined,
        values: (dto.values ?? profile.values) as UserValues,
        communicationStyle: (dto.communicationStyle ??
          profile.communicationStyle) as CommunicationStyle,
        bio: dto.bio ?? profile.bio ?? undefined,
      };
      data.agentPersona = this.generateAgentPersona(merged);
    }

    return this.prisma.profile.update({ where: { id }, data });
  }

  private generateAgentPersona(input: {
    name: string;
    age: number;
    gender: string;
    location: string;
    occupation?: string;
    values: { relationshipGoal: string; lifestyle: string[]; importantValues: string[] };
    communicationStyle: { tone: string; topics: string[] };
    bio?: string;
  }): string {
    const occupationStr = input.occupation
      ? `, 직업: ${input.occupation}`
      : "";
    const bioStr = input.bio ? `\n자기소개: ${input.bio}` : "";

    return (
      `당신은 "Another I"로, ${input.name}님을 대신하는 AI 에이전트입니다.\n` +
      `기본정보: ${input.age}세 ${input.gender}, ${input.location} 거주${occupationStr}\n` +
      `대화 톤: ${input.communicationStyle.tone}\n` +
      `중요 가치관: ${input.values.importantValues.join(", ")}\n` +
      `관계 목표: ${input.values.relationshipGoal}\n` +
      `라이프스타일: ${input.values.lifestyle.join(", ")}\n` +
      `선호 대화 주제: ${input.communicationStyle.topics.join(", ")}` +
      bioStr +
      `\n\n규칙:\n` +
      `- 실제 전화번호, 주소, 직장 상세정보, 금융정보를 절대 공유하지 마세요\n` +
      `- 페르소나에 충실하되 개인 안전을 보호하세요\n` +
      `- 자연스럽고 진정성 있는 대화를 나누세요\n` +
      `- 상대방의 관심사와 가치관에 관해 질문하세요`
    );
  }
}
