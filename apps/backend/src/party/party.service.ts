import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartyDto } from "./dto/create-party.dto";
import type {
  PartyResults,
  RoundResult,
  TableAssignment,
  ConversationContext,
  InteractionSignal,
  RelationshipGoal,
} from "@mingle/shared";

const ICEBREAKERS = [
  "최근에 가장 행복했던 순간은 언제였나요?",
  "여행을 간다면 어디로 가고 싶나요?",
  "주말에 주로 무엇을 하면서 시간을 보내나요?",
  "올해 가장 기억에 남는 경험은 무엇인가요?",
  "어릴 때 꿈꿨던 직업은 무엇이었나요?",
  "좋아하는 음식이나 맛집이 있나요?",
  "요즘 빠져있는 취미가 있나요?",
  "인생에서 가장 중요하게 생각하는 가치는 무엇인가요?",
  "가장 좋아하는 계절과 그 이유는?",
  "스트레스를 받을 때 어떻게 해소하나요?",
];

const TOPIC_POOLS = [
  "여행", "음식", "영화/드라마", "음악", "운동/건강",
  "독서", "반려동물", "가족", "미래 계획", "취미",
  "문화/예술", "자기계발", "일과 삶의 균형", "봉사활동",
  "기술/트렌드", "패션", "자연/환경", "요리", "게임", "사진",
];

type ProfileRow = {
  id: string;
  name: string;
  agentPersona: string;
  preferences: { locationRadius?: number };
  values: { relationshipGoal: RelationshipGoal; lifestyle: string[]; importantValues: string[] };
  communicationStyle: { tone: string; topics: string[] };
};

@Injectable()
export class PartyService {
  constructor(private prisma: PrismaService) {}

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
    const party = await this.prisma.party.findUnique({ where: { id } });
    if (!party) throw new NotFoundException(`파티를 찾을 수 없습니다: ${id}`);
    return party;
  }

  async addParticipant(partyId: string, profileId: string) {
    const party = await this.findOne(partyId);
    if (party.status !== "scheduled")
      throw new BadRequestException("참가 등록은 예정된 파티에만 가능합니다");

    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!profile)
      throw new NotFoundException(`프로필을 찾을 수 없습니다: ${profileId}`);
    if (profile.status !== "active")
      throw new BadRequestException("활성 상태의 프로필만 참가할 수 있습니다");

    const count = await this.prisma.partyParticipant.count({
      where: { partyId },
    });
    if (count >= party.maxParticipants)
      throw new BadRequestException("파티 인원이 가득 찼습니다");

    await this.prisma.partyParticipant.create({
      data: { partyId, profileId },
    });

    return { participantCount: count + 1 };
  }

  async run(partyId: string) {
    const party = await this.findOne(partyId);
    if (party.status !== "scheduled")
      throw new BadRequestException("예정된 파티만 실행할 수 있습니다");

    const participants = await this.prisma.partyParticipant.findMany({
      where: { partyId },
      include: { profile: true },
    });
    if (participants.length < 2)
      throw new BadRequestException("파티 실행에는 최소 2명의 참가자가 필요합니다");

    await this.prisma.party.update({
      where: { id: partyId },
      data: { status: "in_progress" },
    });

    const profiles: ProfileRow[] = participants.map((p) => ({
      id: p.profile.id,
      name: p.profile.name,
      agentPersona: p.profile.agentPersona,
      preferences: p.profile.preferences as ProfileRow["preferences"],
      values: p.profile.values as ProfileRow["values"],
      communicationStyle: p.profile.communicationStyle as ProfileRow["communicationStyle"],
    }));

    const rounds: RoundResult[] = [];
    const allSignals: InteractionSignal[] = [];

    for (let round = 1; round <= party.roundCount; round++) {
      const tables = this.assignTables(profiles, round);
      const conversationContexts = tables.map((table) =>
        this.buildConversationContext(table, profiles, party.theme ?? undefined, round),
      );
      const roundSignals = this.generateInteractionSignals(tables, profiles);
      allSignals.push(...roundSignals);
      rounds.push({ roundNumber: round, tables, conversationContexts });
    }

    const results: PartyResults = { rounds, interactionSignals: allSignals };

    return this.prisma.party.update({
      where: { id: partyId },
      data: { results: results as object, status: "completed" },
    });
  }

  private assignTables(profiles: ProfileRow[], roundSeed: number): TableAssignment[] {
    const shuffled = [...profiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = (i * roundSeed * 7 + 3) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const tables: TableAssignment[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const group = shuffled.slice(i, i + 2);
      if (group.length >= 2) {
        tables.push({ tableId: randomUUID(), profileIds: group.map((p) => p.id) });
      } else if (tables.length > 0) {
        tables[tables.length - 1].profileIds.push(group[0].id);
      }
    }
    return tables;
  }

  private buildConversationContext(
    table: TableAssignment, profiles: ProfileRow[], theme: string | undefined, round: number,
  ): ConversationContext {
    const participants = table.profileIds.map((id) => {
      const p = profiles.find((pr) => pr.id === id)!;
      return {
        profileId: p.id, name: p.name, agentPersona: p.agentPersona,
        relevantPreferences: { locationRadius: p.preferences.locationRadius },
        relevantValues: {
          relationshipGoal: p.values.relationshipGoal,
          lifestyle: p.values.lifestyle,
          importantValues: p.values.importantValues,
        },
      };
    });

    const allTopics = table.profileIds.flatMap((id) => {
      const p = profiles.find((pr) => pr.id === id)!;
      return p.communicationStyle.topics;
    });
    const topicCounts = new Map<string, number>();
    for (const t of allTopics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);

    const suggestedTopics = [...topicCounts.entries()]
      .filter(([, c]) => c > 1).map(([t]) => t);
    if (suggestedTopics.length < 2) {
      suggestedTopics.push(
        ...TOPIC_POOLS.filter((t) => !suggestedTopics.includes(t)).slice(0, 3 - suggestedTopics.length),
      );
    }
    if (theme) suggestedTopics.unshift(theme);

    return {
      tableId: table.tableId, participants,
      suggestedTopics: suggestedTopics.slice(0, 5),
      icebreaker: ICEBREAKERS[(round - 1) % ICEBREAKERS.length],
    };
  }

  private generateInteractionSignals(
    tables: TableAssignment[], profiles: ProfileRow[],
  ): InteractionSignal[] {
    const signals: InteractionSignal[] = [];
    for (const table of tables) {
      const tp = table.profileIds.map((id) => profiles.find((p) => p.id === id)!);
      for (let i = 0; i < tp.length; i++) {
        for (let j = i + 1; j < tp.length; j++) {
          const a = tp[i], b = tp[j];
          const sv = a.values.importantValues.filter((v) => b.values.importantValues.includes(v));
          if (sv.length > 0)
            signals.push({ fromProfileId: a.id, toProfileId: b.id, signalType: "shared_value", strength: Math.min(sv.length / 3, 1), context: `공유 가치관: ${sv.join(", ")}` });
          const sl = a.values.lifestyle.filter((l) => b.values.lifestyle.includes(l));
          if (sl.length > 0)
            signals.push({ fromProfileId: a.id, toProfileId: b.id, signalType: "rapport", strength: Math.min(sl.length / 3, 1), context: `공유 라이프스타일: ${sl.join(", ")}` });
          const st = a.communicationStyle.topics.filter((t) => b.communicationStyle.topics.includes(t));
          if (st.length > 0)
            signals.push({ fromProfileId: a.id, toProfileId: b.id, signalType: "interest", strength: Math.min(st.length / 3, 1), context: `공유 관심사: ${st.join(", ")}` });
          if (a.values.relationshipGoal === b.values.relationshipGoal)
            signals.push({ fromProfileId: a.id, toProfileId: b.id, signalType: "deep_conversation", strength: 0.8, context: `관계 목표 일치: ${a.values.relationshipGoal}` });
        }
      }
    }
    return signals;
  }
}
