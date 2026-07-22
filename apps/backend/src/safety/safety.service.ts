import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { blockPairKey } from "@mingle/shared";
import type {
  SafetyContext,
  SafetyResult,
  Violation,
  ViolationType,
  ViolationSeverity,
  PeerProfile,
} from "@mingle/shared";

const KOREAN_PHONE_REGEX = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g;
const PHONE_REGEX =
  /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SOCIAL_MEDIA_REGEX =
  /(?:@[\w.]{3,})|(?:(?:instagram|insta|카카오톡?|카톡|라인|텔레그램|telegram|line)\s*[:.]?\s*[\w.]+)/gi;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const MONEY_KEYWORDS =
  /투자|코인|비트코인|이체|계좌|송금|돈\s?빌려|대출|loan|invest|crypto|bitcoin|wire\s?transfer/gi;
const HARMFUL_KEYWORDS_KR =
  /씨발|시발|개새끼|병신|지랄|꺼져|죽어|자살|살해|성폭행|강간/gi;
const HARMFUL_KEYWORDS_EN =
  /\b(kill|murder|suicide|rape|stalk|threat)\b/gi;

interface PatternCheck {
  regex: RegExp;
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
}

const PATTERN_CHECKS: PatternCheck[] = [
  { regex: KOREAN_PHONE_REGEX, type: "personal_info_leak", severity: "high", description: "한국 전화번호가 감지되었습니다" },
  { regex: PHONE_REGEX, type: "personal_info_leak", severity: "high", description: "전화번호가 감지되었습니다" },
  { regex: EMAIL_REGEX, type: "personal_info_leak", severity: "high", description: "이메일 주소가 감지되었습니다" },
  { regex: SOCIAL_MEDIA_REGEX, type: "personal_info_leak", severity: "medium", description: "SNS 계정 정보가 감지되었습니다" },
  { regex: URL_REGEX, type: "external_link", severity: "medium", description: "외부 링크가 감지되었습니다" },
  { regex: MONEY_KEYWORDS, type: "fraud_signal", severity: "high", description: "금전/투자 관련 키워드가 감지되었습니다" },
  { regex: HARMFUL_KEYWORDS_KR, type: "harassment", severity: "critical", description: "유해 표현(한국어)이 감지되었습니다" },
  { regex: HARMFUL_KEYWORDS_EN, type: "harassment", severity: "critical", description: "유해 표현(영어)이 감지되었습니다" },
];

@Injectable()
export class SafetyService {
  constructor(private prisma: PrismaService) {}

  checkContent(content: string, _context: SafetyContext): SafetyResult {
    const violations: Violation[] = [];

    for (const check of PATTERN_CHECKS) {
      const regex = new RegExp(check.regex.source, check.regex.flags);
      const matches = content.match(regex);
      if (matches) {
        violations.push({
          type: check.type,
          severity: check.severity,
          description: check.description,
          matchedContent: matches[0],
        });
      }
    }

    let sanitizedContent = content;
    sanitizedContent = sanitizedContent.replace(KOREAN_PHONE_REGEX, "[전화번호 제거됨]");
    sanitizedContent = sanitizedContent.replace(PHONE_REGEX, "[전화번호 제거됨]");
    sanitizedContent = sanitizedContent.replace(EMAIL_REGEX, "[이메일 제거됨]");
    sanitizedContent = sanitizedContent.replace(SOCIAL_MEDIA_REGEX, "[SNS정보 제거됨]");

    const riskScore = this.calculateRiskScore(violations);

    return {
      safe: violations.length === 0,
      violations,
      riskScore,
      sanitizedContent: violations.length > 0 ? sanitizedContent : undefined,
    };
  }

  async reportUser(
    reporterProfileId: string,
    reportedProfileId: string,
    reason: string,
    details?: string,
    evidencePartyId?: string,
  ) {
    // Self-report guard
    if (reporterProfileId === reportedProfileId) {
      throw new BadRequestException("자신을 신고할 수 없습니다");
    }

    const reported = await this.prisma.profile.findUnique({
      where: { id: reportedProfileId },
    });
    if (!reported) {
      throw new NotFoundException("신고할 프로필을 찾을 수 없습니다");
    }

    if (evidencePartyId) {
      const sharedPartyMembers = await this.prisma.partyParticipant.count({
        where: {
          partyId: evidencePartyId,
          profileId: { in: [reporterProfileId, reportedProfileId] },
        },
      });
      if (sharedPartyMembers !== 2) {
        throw new BadRequestException("함께 참여한 파티만 신고 근거로 연결할 수 있습니다");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.safetyReport.create({
        data: {
          reporterProfileId,
          reportedProfileId,
          reason,
          details,
          evidencePartyId,
        },
      });

      // The unique contribution row makes concurrent duplicate reports harmless while
      // preserving every incident report for moderator review.
      const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "safety_risk_contributions"
          ("id", "reporter_profile_id", "reported_profile_id", "created_at")
        VALUES
          (${randomUUID()}, ${reporterProfileId}, ${reportedProfileId}, NOW())
        ON CONFLICT ("reporter_profile_id", "reported_profile_id") DO NOTHING
        RETURNING "id"
      `);

      if (inserted.length > 0) {
        const updated = await tx.profile.update({
          where: { id: reportedProfileId },
          data: { riskScore: { increment: 0.2 } },
        });
        if (updated.riskScore >= 1.0 && updated.status === "active") {
          await tx.profile.update({
            where: { id: reportedProfileId },
            data: { status: "suspended" },
          });
        }
      }

      return report;
    });
  }

  async createBlock(blockerProfileId: string, blockedProfileId: string) {
    if (blockerProfileId === blockedProfileId) {
      throw new BadRequestException("자신을 차단할 수 없습니다");
    }
    if (blockedProfileId.startsWith("ai-")) {
      throw new BadRequestException("게임 AI는 차단 대상이 아닙니다");
    }
    const target = await this.prisma.profile.findUnique({
      where: { id: blockedProfileId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("차단할 프로필을 찾을 수 없습니다");
    return this.prisma.block.upsert({
      where: { blockerProfileId_blockedProfileId: { blockerProfileId, blockedProfileId } },
      create: { blockerProfileId, blockedProfileId },
      update: {},
    });
  }

  async listBlocks(profileId: string): Promise<PeerProfile[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerProfileId: profileId },
      include: { blocked: true },
    });
    return rows.map((row) => this.toPeer(row.blocked));
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

  isBlockedBetween(a: string, b: string): Promise<boolean> {
    return this.prisma.block
      .findFirst({
        where: {
          OR: [
            { blockerProfileId: a, blockedProfileId: b },
            { blockerProfileId: b, blockedProfileId: a },
          ],
        },
      })
      .then((row) => row !== null);
  }

  /** All block pairs (as order-independent keys) among the given profile ids. */
  async blocksForProfiles(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.block.findMany({
      where: { blockerProfileId: { in: ids }, blockedProfileId: { in: ids } },
      select: { blockerProfileId: true, blockedProfileId: true },
    });
    return new Set(rows.map((r) => blockPairKey(r.blockerProfileId, r.blockedProfileId)));
  }

  async removeBlock(blockerProfileId: string, blockedProfileId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerProfileId, blockedProfileId } });
  }

  private calculateRiskScore(violations: Violation[]): number {
    if (violations.length === 0) return 0;
    const weights: Record<ViolationSeverity, number> = {
      low: 0.1,
      medium: 0.25,
      high: 0.5,
      critical: 1.0,
    };
    const total = violations.reduce((sum, v) => sum + weights[v.severity], 0);
    return Math.min(total, 1.0);
  }
}
