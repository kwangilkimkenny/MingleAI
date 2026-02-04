import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { ReportRepo } from "../storage/report.repo.js";
import { PartyRepo } from "../storage/party.repo.js";
import { ProfileRepo } from "../storage/profile.repo.js";
import type { Report, ReportType, MatchScore, ConversationHighlight, ActionRecommendation, InteractionSignal } from "@mingle/shared";

export class ReportService {
  private reportRepo: ReportRepo;
  private partyRepo: PartyRepo;
  private profileRepo: ProfileRepo;

  constructor(db: Database.Database) {
    this.reportRepo = new ReportRepo(db);
    this.partyRepo = new PartyRepo(db);
    this.profileRepo = new ProfileRepo(db);
  }

  generate(partyId: string, profileId: string, reportType: ReportType): Report {
    const party = this.partyRepo.findById(partyId);
    if (!party) throw new Error(`파티를 찾을 수 없습니다: ${partyId}`);
    if (!party.results) throw new Error("파티가 아직 완료되지 않았습니다");

    const profile = this.profileRepo.findById(profileId);
    if (!profile) throw new Error(`프로필을 찾을 수 없습니다: ${profileId}`);

    const participantIds = this.partyRepo.getParticipantIds(partyId);
    if (!participantIds.includes(profileId)) {
      throw new Error("이 사용자는 해당 파티에 참가하지 않았습니다");
    }

    // Gather all interaction signals involving this profile
    const relevantSignals = party.results.interactionSignals.filter(
      (s) => s.fromProfileId === profileId || s.toProfileId === profileId
    );

    // Find unique partner IDs
    const partnerIds = new Set<string>();
    for (const signal of relevantSignals) {
      const partnerId = signal.fromProfileId === profileId ? signal.toProfileId : signal.fromProfileId;
      partnerIds.add(partnerId);
    }

    const matchScores: MatchScore[] = [];
    const highlights: ConversationHighlight[] = [];
    const recommendations: ActionRecommendation[] = [];

    for (const partnerId of partnerIds) {
      const partner = this.profileRepo.findById(partnerId);
      if (!partner) continue;

      const partnerSignals = relevantSignals.filter(
        (s) => s.fromProfileId === partnerId || s.toProfileId === partnerId
      );

      // Calculate match score
      const score = this.calculateMatchScore(profile, partner, partnerSignals);
      matchScores.push({
        partnerId,
        partnerName: partner.name,
        ...score,
      });

      // Generate highlights
      highlights.push(this.generateHighlights(partnerId, partner.name, partnerSignals, profile, partner));

      // Generate recommendations
      recommendations.push(this.generateRecommendations(partnerId, partner.name, score.overallScore, partnerSignals));
    }

    // Sort by overall score descending
    matchScores.sort((a, b) => b.overallScore - a.overallScore);

    const report: Report = {
      id: randomUUID(),
      partyId,
      profileId,
      reportType,
      matchScores,
      highlights,
      recommendations,
      createdAt: new Date().toISOString(),
    };

    this.reportRepo.insert(report);
    return report;
  }

  getById(id: string): Report | null {
    return this.reportRepo.findById(id);
  }

  listByProfile(profileId: string, limit = 10, offset = 0): Report[] {
    return this.reportRepo.findByProfileId(profileId, limit, offset);
  }

  private calculateMatchScore(
    user: { values: { importantValues: string[]; lifestyle: string[]; relationshipGoal: string }; communicationStyle: { topics: string[]; tone: string } },
    partner: { values: { importantValues: string[]; lifestyle: string[]; relationshipGoal: string }; communicationStyle: { topics: string[]; tone: string } },
    signals: InteractionSignal[]
  ): { overallScore: number; breakdown: MatchScore["breakdown"]; explanation: string } {
    // Values alignment
    const sharedValues = user.values.importantValues.filter((v) =>
      partner.values.importantValues.includes(v)
    );
    const maxValues = Math.max(user.values.importantValues.length, partner.values.importantValues.length, 1);
    const valuesAlignment = Math.round((sharedValues.length / maxValues) * 100);

    // Lifestyle compatibility
    const sharedLifestyle = user.values.lifestyle.filter((l) =>
      partner.values.lifestyle.includes(l)
    );
    const maxLifestyle = Math.max(user.values.lifestyle.length, partner.values.lifestyle.length, 1);
    const lifestyleCompatibility = Math.round((sharedLifestyle.length / maxLifestyle) * 100);

    // Communication fit
    const sharedTopics = user.communicationStyle.topics.filter((t) =>
      partner.communicationStyle.topics.includes(t)
    );
    const maxTopics = Math.max(user.communicationStyle.topics.length, partner.communicationStyle.topics.length, 1);
    let communicationFit = Math.round((sharedTopics.length / maxTopics) * 100);
    if (user.communicationStyle.tone === partner.communicationStyle.tone) {
      communicationFit = Math.min(communicationFit + 20, 100);
    }

    // Interest chemistry (from signals)
    const avgStrength = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length
      : 0;
    const interestChemistry = Math.round(avgStrength * 100);

    // Goal bonus
    const goalBonus = user.values.relationshipGoal === partner.values.relationshipGoal ? 10 : 0;

    const overallScore = Math.min(
      Math.round(
        valuesAlignment * 0.3 +
        lifestyleCompatibility * 0.2 +
        communicationFit * 0.25 +
        interestChemistry * 0.25 +
        goalBonus
      ),
      100
    );

    const explanationParts: string[] = [];
    if (sharedValues.length > 0) explanationParts.push(`공유 가치관(${sharedValues.join(", ")})`);
    if (sharedLifestyle.length > 0) explanationParts.push(`공유 라이프스타일(${sharedLifestyle.join(", ")})`);
    if (sharedTopics.length > 0) explanationParts.push(`공유 관심사(${sharedTopics.join(", ")})`);
    if (goalBonus > 0) explanationParts.push(`관계 목표 일치(${user.values.relationshipGoal})`);

    const explanation = explanationParts.length > 0
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
    user: { values: { importantValues: string[]; lifestyle: string[] }; communicationStyle: { topics: string[] } },
    partner: { values: { importantValues: string[]; lifestyle: string[] }; communicationStyle: { topics: string[] } }
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
    signals: InteractionSignal[]
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
