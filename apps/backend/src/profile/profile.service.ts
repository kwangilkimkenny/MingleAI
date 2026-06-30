import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

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

    return this.prisma.profile.create({
      data: {
        userId,
        name: dto.name,
        age: dto.age,
        gender: dto.gender,
        occupation: dto.occupation,
        partyPreferenceText: dto.partyPreferenceText,
        bio: dto.bio,
        location: dto.location,
        photoUrl: dto.photoUrl,
        interests: dto.interests as object ?? undefined,
        preferenceSignals: dto.preferenceSignals as object ?? undefined,
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

    return this.prisma.profile.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });
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
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.age !== undefined) data.age = dto.age;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.occupation !== undefined) data.occupation = dto.occupation;
    if (dto.partyPreferenceText !== undefined) data.partyPreferenceText = dto.partyPreferenceText;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.interests !== undefined) data.interests = dto.interests as object;
    if (dto.preferenceSignals !== undefined) data.preferenceSignals = dto.preferenceSignals as object;

    return this.prisma.profile.update({ where: { id }, data });
  }
}
