import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {
  PREFERENCE_ANALYZER,
  PreferenceAnalyzer,
  PreferenceAnalysisError,
} from "../ai/preference-analyzer.interface";

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    @Inject(PREFERENCE_ANALYZER) private analyzer: PreferenceAnalyzer,
  ) {}

  async create(userId: string, dto: CreateProfileDto) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException("이미 프로필이 존재합니다");
    }

    // I2: also catch a concurrent-duplicate P2002 that races past the pre-check
    let profile: { id: string } & Record<string, any>;
    try {
      profile = await this.prisma.profile.create({
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
          interests: (dto.interests as object) ?? undefined,
          preferenceSignals: undefined, // server-owned
        },
        omit: { riskScore: true },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        throw new ConflictException("이미 프로필이 존재합니다");
      }
      throw e;
    }
    return this.runAnalysis(profile, dto);
  }

  private async runAnalysis(
    profile: { id: string } & Record<string, any>,
    src: { partyPreferenceText: string; gender: string; age: number; occupation: string },
  ) {
    let signals: object;
    try {
      signals = await this.analyzer.analyze({
        partyPreferenceText: src.partyPreferenceText,
        gender: src.gender,
        age: src.age,
        occupation: src.occupation,
      });
    } catch (e) {
      // Generic errors from the analyzer itself still propagate (cost/abuse semantics);
      // only PreferenceAnalysisError (expected LLM failure) silently falls back to null.
      if (!(e instanceof PreferenceAnalysisError)) throw e;
      console.warn(
        `[preference] analysis failed for profile ${profile.id}:`,
        (e as Error).message,
      );
      // Strip riskScore before returning (reanalyze path loads profile via findUnique)
      const { riskScore: _r1, ...safeOnAnalysisFail } = profile;
      return safeOnAnalysisFail;
    }

    // I1: persist signals best-effort — a transient DB error must not 500 onboarding
    try {
      return await this.prisma.profile.update({
        where: { id: profile.id },
        data: { preferenceSignals: signals as object },
        omit: { riskScore: true },
      });
    } catch (e) {
      console.warn(
        `[preference] failed to persist signals for profile ${profile.id}:`,
        (e as Error).message,
      );
      const { riskScore: _r2, ...safeOnPersistFail } = profile;
      return { ...safeOnPersistFail, preferenceSignals: null };
    }
  }

  async reanalyze(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException("프로필이 없습니다");
    return this.runAnalysis(profile, profile as any);
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return null;
    const { riskScore: _riskScore, ...safeProfile } = profile;
    return safeProfile;
  }

  async findOne(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    // M6: only expose active profiles; M7: static error message (no raw id reflection)
    if (!profile || profile.status !== "active") {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    const { riskScore: _riskScore, ...safeProfile } = profile;
    return safeProfile;
  }

  async findAll(filters?: {
    location?: string;
    ageMin?: number;
    ageMax?: number;
    limit?: number;
    offset?: number;
  }) {
    const rawLimit = filters?.limit ?? 20;
    const rawOffset = filters?.offset ?? 0;
    // Clamp limit to [1, 50]; fall back to 20 for non-numeric (NaN/Infinity) input (M5)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(1, Math.floor(rawLimit)), 50)
      : 20;
    // Clamp offset to >= 0; fall back to 0 for non-numeric input
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

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
    // Strip internal safety score before returning to callers
    return profiles.map(({ riskScore: _riskScore, ...p }) => p);
  }

  async update(id: string, userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
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

    const updated = await this.prisma.profile.update({ where: { id }, data, omit: { riskScore: true } });

    // I3: only re-analyze when the preference text is provided AND actually changed
    if (
      dto.partyPreferenceText !== undefined &&
      dto.partyPreferenceText !== profile.partyPreferenceText
    ) {
      return this.runAnalysis(updated, updated as any);
    }
    return updated;
  }
}
