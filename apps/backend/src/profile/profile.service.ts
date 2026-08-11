import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { buildPreferenceSignals, describePreferences, type PreferenceAnswers } from "@mingle/shared";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import {
  PREFERENCE_ANALYZER,
  PreferenceAnalyzer,
  PreferenceAnalysisError,
} from "../ai/preference-analyzer.interface";
import { normalizeUploadUrl, PROFILE_PHOTO_PATH } from "../common/uploads-url";

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    @Inject(PREFERENCE_ANALYZER) private analyzer: PreferenceAnalyzer,
  ) {}

  async create(userId: string, dto: CreateProfileDto) {
    this.assertOwnedPhotoUrl(dto.photoUrl);
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException("이미 프로필이 존재합니다");
    }

    // Verified real-name identity (본인인증) is authoritative — override self-reported gender/age.
    const verified = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedGender: true, verifiedBirth: true },
    });
    const gender = verified?.verifiedGender ?? dto.gender;
    const age = verified?.verifiedBirth ? this.ageFrom(verified.verifiedBirth) : dto.age;
    if (!gender || age == null) {
      throw new BadRequestException("본인인증을 먼저 완료해 주세요");
    }

    // 구조화 선호(2026-08-06)가 오면 그것이 진실 — 텍스트도 서버가 생성한다.
    // 자유서술만 온 경우(레거시/외부 클라)에만 AI 분석기를 태운다.
    const answers = dto.preferences as PreferenceAnswers | undefined;
    const preferenceText = answers
      ? describePreferences(answers)
      : dto.partyPreferenceText;
    if (!preferenceText) {
      throw new BadRequestException("선호 정보를 입력해 주세요");
    }

    // I2: also catch a concurrent-duplicate P2002 that races past the pre-check
    let profile: { id: string } & Record<string, any>;
    try {
      profile = await this.prisma.profile.create({
        data: {
          userId,
          name: this.cleanNickname(dto.name),
          age,
          gender,
          occupation: dto.occupation,
          partyPreferenceText: preferenceText,
          bio: dto.bio,
          location: dto.location,
          photoUrl: dto.photoUrl,
          interests: (dto.interests as object) ?? undefined,
          // 구조화 선택은 결정적으로 신호가 된다(분석기 불필요). 텍스트만 온 경우 아래 runAnalysis.
          preferenceSignals: answers ? (buildPreferenceSignals(answers) as object) : undefined,
        },
        omit: { riskScore: true },
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        throw new ConflictException("이미 프로필이 존재합니다");
      }
      throw e;
    }
    if (answers) {
      const { riskScore: _r, ...safe } = profile;
      return safe;
    }
    return this.runAnalysis(profile, {
      ...dto,
      partyPreferenceText: preferenceText,
      gender,
      age,
    });
  }

  private ageFrom(birth: Date): number {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
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

  // 임의 프로필 조회(findOne)·목록(findAll)은 2026-08-11 삭제 — 라우트와 함께.
  // 상세 이유는 profile.controller.ts 주석 참조(블라인드 단계 우회 노출).

  async update(id: string, userId: string, dto: UpdateProfileDto) {
    this.assertOwnedPhotoUrl(dto.photoUrl);
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException("프로필을 찾을 수 없습니다");
    }
    if (profile.userId !== userId) {
      throw new ForbiddenException("본인의 프로필만 수정할 수 있습니다");
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = this.cleanNickname(dto.name);
    // 나이·성별은 본인인증이 진실이라 수정 대상이 아니다(2026-08-11). DTO에서도 제거했다 —
    // 예전에는 PATCH로 gender를 뒤집어 반대 성별 큐(남3+여3)에 들어갈 수 있었다.
    if (dto.occupation !== undefined) data.occupation = dto.occupation.trim();
    // 구조화 선호가 오면 텍스트·신호 둘 다 서버가 결정적으로 갱신한다(분석기 불필요).
    const answers = dto.preferences as PreferenceAnswers | undefined;
    if (answers) {
      data.partyPreferenceText = describePreferences(answers);
      data.preferenceSignals = buildPreferenceSignals(answers) as object;
    } else if (dto.partyPreferenceText !== undefined) {
      data.partyPreferenceText = dto.partyPreferenceText;
    }
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.interests !== undefined) data.interests = dto.interests as object;

    // I3: only re-analyze when the LEGACY free text is provided AND actually changed
    // (구조화 선호 경로는 위에서 이미 신호를 확정했으므로 분석 불필요)
    const textChanged =
      !answers &&
      dto.partyPreferenceText !== undefined &&
      dto.partyPreferenceText !== profile.partyPreferenceText;
    // M1: when the text changes, the old signals no longer describe it — clear them so a
    // failed re-analysis leaves preferenceSignals=null (needs reanalysis), not stale data.
    if (textChanged) data.preferenceSignals = null;

    const updated = await this.prisma.profile.update({ where: { id }, data, omit: { riskScore: true } });

    if (textChanged) {
      return this.runAnalysis(updated, updated as any);
    }
    return updated;
  }

  /**
   * 닉네임 정리 — 공백만 남는 값(@IsNotEmpty는 "   "를 통과시킨다)과 마크업/제어문자를 막는다.
   * 닉네임은 대화 상대와 관리자 콘솔 양쪽에 그대로 보이는 유일한 자유 입력이다.
   */
  private cleanNickname(raw: string): string {
    const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!name) throw new BadRequestException("닉네임을 입력해 주세요");
    if (/[<>]/.test(name)) throw new BadRequestException("닉네임에 사용할 수 없는 문자가 있어요");
    return name;
  }

  private assertOwnedPhotoUrl(photoUrl: string | undefined): void {
    if (!photoUrl) return;
    // 호스트 검증은 normalizeUploadUrl과 공유한다(채팅 첨부와 같은 규칙).
    if (!normalizeUploadUrl(photoUrl, PROFILE_PHOTO_PATH)) {
      throw new BadRequestException("앱에서 업로드한 프로필 사진만 사용할 수 있습니다");
    }
  }
}
