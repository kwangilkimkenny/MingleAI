import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ReportType,
  MatchScore,
  ConversationHighlight,
  ActionRecommendation,
  InteractionSignal,
  PartyResults,
} from "@mingle/shared";

type ProfileRow = {
  id: string;
  name: string;
  values: {
    relationshipGoal: string;
    lifestyle: string[];
    importantValues: string[];
  };
  communicationStyle: { tone: string; topics: string[] };
};

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async generate(partyId: string, profileId: string, reportType: ReportType = "summary") {
    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException(`파티를 찾을 수 없습니다: ${partyId}`);
    if (!party.results) throw new BadRequestException("파티가 아직 완료되지 않았습니다");

    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException(`프로필을 찾을 수 없습니다: ${profileId}`);

    const participant = await this.prisma.partyParticipant.findUnique({
      where: { partyId_profileId: { partyId, profileId } },
    });
    if (!participant)
      throw new BadRequestException("이 사용자는 해당 파티에 참가하지 않았습니다");

    const results = party.results as unknown as PartyResults;
    const relevantSignals = results.interactionSignals.filter(
      (s) => s.fromProfileId === profileId || s.toProfileId === profileId,
    );

    const partnerIds = new Set<string>();
    for (const signal of relevantSignals) {
      const partnerId =
        signal.fromProfileId === profileId ? signal.toProfileId : signal.fromProfileId;
      partnerIds.add(partnerId);
    }

    const user = profile as unknown as ProfileRow;
    const matchScores: MatchScore[] = [];
    const highlights: ConversationHighlight[] = [];
    const recommendations: ActionRecommendation[] = [];

    for (const partnerId of partnerIds) {
      const partnerRow = await this.prisma.profile.findUnique({ where: { id: partnerId } });
      if (!partnerRow) continue;
      const partner = partnerRow as unknown as ProfileRow;

      const partnerSignals = relevantSignals.filter(
        (s) => s.fromProfileId === partnerId || s.toProfileId === partnerId,
      );

      const score = this.calculateMatchScore(user, partner, partnerSignals);
      matchScores.push({ partnerId, partnerName: partner.name, ...score });
      highlights.push(this.generateHighlights(partnerId, partner.name, partnerSignals, user, partner));
      recommendations.push(this.generateRecommendations(partnerId, partner.name, score.overallScore, partnerSignals));
    }

    matchScores.sort((a, b) => b.overallScore - a.overallScore);

    return this.prisma.report.create({
      data: {
        partyId,
        profileId,
        reportType,
        matchScores: matchScores as object[],
        highlights: highlights as object[],
        recommendations: recommendations as object[],
      },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`리포트를 찾을 수 없습니다: ${id}`);
    return report;
  }

  async findByProfile(profileId: string, limit = 10, offset = 0) {
    return this.prisma.report.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  private calculateMatchScore(
    user: ProfileRow,
    partner: ProfileRow,
    signals: InteractionSignal[],
  ): { overallScore: number; breakdown: MatchScore["breakdown"]; explanation: string } {
    const sharedValues = user.values.importantValues.filter((v) =>
      partner.values.importantValues.includes(v),
    );
    const maxValues = Math.max(user.values.importantValues.length, partner.values.importantValues.length, 1);
    const valuesAlignment = Math.round((sharedValues.length / maxValues) * 100);

    const sharedLifestyle = user.values.lifestyle.filter((l) =>
      partner.values.lifestyle.includes(l),
    );
    const maxLifestyle = Math.max(user.values.lifestyle.length, partner.values.lifestyle.length, 1);
    const lifestyleCompatibility = Math.round((sharedLifestyle.length / maxLifestyle) * 100);

    const sharedTopics = user.communicationStyle.topics.filter((t) =>
      partner.communicationStyle.topics.includes(t),
    );
    const maxTopics = Math.max(user.communicationStyle.topics.length, partner.communicationStyle.topics.length, 1);
    let communicationFit = Math.round((sharedTopics.length / maxTopics) * 100);
    if (user.communicationStyle.tone === partner.communicationStyle.tone) {
      communicationFit = Math.min(communicationFit + 20, 100);
    }

    const avgStrength =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length
        : 0;
    const interestChemistry = Math.round(avgStrength * 100);

    const goalBonus = user.values.relationshipGoal === partner.values.relationshipGoal ? 10 : 0;

    const overallScore = Math.min(
      Math.round(
        valuesAlignment * 0.3 +
          lifestyleCompatibility * 0.2 +
          communicationFit * 0.25 +
          interestChemistry * 0.25 +
          goalBonus,
      ),
      100,
    );

    const explanationParts: string[] = [];
    if (sharedValues.length > 0) explanationParts.push(`공유 가치관(${sharedValues.join(", ")})`);
    if (sharedLifestyle.length > 0) explanationParts.push(`공유 라이프스타일(${sharedLifestyle.join(", ")})`);
    if (sharedTopics.length > 0) explanationParts.push(`공유 관심사(${sharedTopics.join(", ")})`);
    if (goalBonus > 0) explanationParts.push(`관계 목표 일치(${user.values.relationshipGoal})`);

    const explanation =
      explanationParts.length > 0
        ? `매칭 근거: ${explanationParts.join(", ")}`
        : "공유 요소가 적어 탐색적 만남을 추천합니다";

    return {
      overallScore,
      breakdown: { valuesAlignment, lifestyleCompatibility, communicationFit, interestChemistry },
      explanation,
    };
  }

  private generateHighlights(
    partnerId: string,
    partnerName: string,
    signals: InteractionSignal[],
    user: ProfileRow,
    partner: ProfileRow,
  ): ConversationHighlight {
    const highlightTexts = signals.map((s) => s.context);

    const sharedInterests = [
      ...user.communicationStyle.topics.filter((t) => partner.communicationStyle.topics.includes(t)),
      ...user.values.lifestyle.filter((l) => partner.values.lifestyle.includes(l)),
    ];

    const notableExchanges = signals
      .filter((s) => s.strength >= 0.6)
      .map((s) => `${s.signalType}: ${s.context}`);

    return {
      partnerId,
      partnerName,
      highlights: highlightTexts,
      sharedInterests: [...new Set(sharedInterests)],
      notableExchanges,
    };
  }

  private generateRecommendations(
    partnerId: string,
    partnerName: string,
    overallScore: number,
    signals: InteractionSignal[],
  ): ActionRecommendation {
    const actions: ActionRecommendation["recommendedActions"] = [];

    if (overallScore >= 70) {
      actions.push({
        type: "suggest_date",
        content: `${partnerName}님과의 만남을 제안해보세요`,
        rationale: `높은 호환성 점수(${overallScore}점)를 기반으로 실제 만남을 추천합니다`,
      });
    }

    if (overallScore >= 50) {
      const sharedContext = signals.find((s) => s.strength >= 0.5);
      actions.push({
        type: "send_message",
        content: sharedContext
          ? `${sharedContext.context}에 대해 더 이야기해보는 건 어떨까요?`
          : `${partnerName}님, 반가워요! 좀 더 이야기 나눠볼까요?`,
        rationale: "공유된 관심사를 기반으로 대화를 시작하세요",
      });
    }

    if (overallScore >= 30 && overallScore < 50) {
      actions.push({
        type: "learn_more",
        content: `${partnerName}님에 대해 더 알아보세요`,
        rationale: "아직 충분한 데이터가 없습니다. 다음 파티에서 더 대화해보세요",
      });
    }

    if (overallScore < 30) {
      actions.push({
        type: "pass",
        content: "다른 매칭을 탐색해보세요",
        rationale: "공유 요소가 적어 다른 참가자와의 매칭을 추천합니다",
      });
    }

    return { partnerId, partnerName, recommendedActions: actions };
  }
}
