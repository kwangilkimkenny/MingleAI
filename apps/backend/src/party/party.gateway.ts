/**
 * 파티 WebSocket 게이트웨이
 * 실시간 파티 시뮬레이션을 위한 WebSocket 서버
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// 파티 참가자 위치 및 상태
export interface ParticipantState {
  profileId: string;
  name: string;
  avatarUrl?: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  animation: "idle" | "walking" | "talking" | "waving" | "sitting";
  isTalking: boolean;
  currentMessage?: string;
}

// 파티 상태
export interface PartyState {
  partyId: string;
  status: "waiting" | "running" | "paused" | "completed";
  currentRound: number;
  totalRounds: number;
  participants: ParticipantState[];
  tables: {
    tableId: string;
    position: { x: number; y: number; z: number };
    participantIds: string[];
  }[];
  currentConversation?: {
    tableId: string;
    speakerId: string;
    message: string;
    timestamp: number;
  };
}

// 대화 메시지
export interface ConversationMessage {
  speakerId: string;
  speakerName: string;
  message: string;
  timestamp: number;
  emotion?: "happy" | "curious" | "excited" | "thoughtful" | "neutral";
}

// 아이스브레이커 질문들
const ICEBREAKERS = [
  "최근에 가장 행복했던 순간은 언제였나요?",
  "여행을 간다면 어디로 가고 싶나요?",
  "주말에 주로 무엇을 하면서 시간을 보내나요?",
  "올해 가장 기억에 남는 경험은 무엇인가요?",
  "어릴 때 꿈꿨던 직업은 무엇이었나요?",
  "좋아하는 음식이나 맛집이 있나요?",
  "요즘 빠져있는 취미가 있나요?",
  "인생에서 가장 중요하게 생각하는 가치는 무엇인가요?",
];

// 대화 템플릿 (Claude API 없을 때 사용)
const CONVERSATION_TEMPLATES = [
  { emotion: "curious", template: "오, 정말요? {topic}에 대해 더 알려주세요!" },
  { emotion: "happy", template: "저도 {topic} 정말 좋아해요! 우리 통하네요." },
  { emotion: "excited", template: "와, {topic}라니! 저도 관심 있었어요." },
  { emotion: "thoughtful", template: "흥미롭네요. {topic}에 대해 깊이 생각해본 적 있어요." },
  { emotion: "neutral", template: "{topic}에 대해 이야기해볼까요?" },
];

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/party",
})
export class PartyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger("PartyGateway");
  private partyStates = new Map<string, PartyState>();
  private partyIntervals = new Map<string, NodeJS.Timeout>();

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // 빈 파티 룸 정리: 마지막 클라이언트가 나가면 메모리 해제
    for (const [partyId] of this.partyStates) {
      const room = this.server.sockets.adapter.rooms.get(`party:${partyId}`);
      if (!room || room.size === 0) {
        this.cleanupParty(partyId);
      }
    }
  }

  private cleanupParty(partyId: string) {
    const interval = this.partyIntervals.get(partyId);
    if (interval) {
      clearInterval(interval);
      this.partyIntervals.delete(partyId);
    }
    this.partyStates.delete(partyId);
    this.logger.log(`Party ${partyId} state cleaned up`);
  }

  // 파티 룸 참가
  @SubscribeMessage("joinParty")
  async handleJoinParty(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partyId: string },
  ) {
    const { partyId } = data;
    client.join(`party:${partyId}`);
    this.logger.log(`Client ${client.id} joined party ${partyId}`);

    // 현재 파티 상태 전송
    const state = this.partyStates.get(partyId);
    if (state) {
      client.emit("partyState", state);
    }

    return { success: true, partyId };
  }

  // 파티 룸 떠나기
  @SubscribeMessage("leaveParty")
  handleLeaveParty(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partyId: string },
  ) {
    const { partyId } = data;
    client.leave(`party:${partyId}`);
    this.logger.log(`Client ${client.id} left party ${partyId}`);
    return { success: true };
  }

  // 파티 시뮬레이션 시작
  @SubscribeMessage("startPartySimulation")
  async handleStartPartySimulation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { partyId: string },
  ) {
    const { partyId } = data;

    // 파티 정보 조회
    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        participants: {
          include: { profile: true },
        },
      },
    });

    if (!party) {
      return { success: false, error: "파티를 찾을 수 없습니다" };
    }

    if (party.participants.length < 2) {
      return { success: false, error: "최소 2명의 참가자가 필요합니다" };
    }

    // 초기 파티 상태 설정
    const initialState = this.initializePartyState(party);
    this.partyStates.set(partyId, initialState);

    // 파티 시작 알림
    this.server.to(`party:${partyId}`).emit("partyStarted", initialState);

    // 시뮬레이션 시작
    this.startSimulation(partyId, party);

    return { success: true, state: initialState };
  }

  // 파티 상태 초기화
  private initializePartyState(party: any): PartyState {
    const participants: ParticipantState[] = party.participants.map(
      (p: any, index: number) => {
        // 원형으로 배치
        const angle = (index / party.participants.length) * Math.PI * 2;
        const radius = 5;

        return {
          profileId: p.profile.id,
          name: p.profile.name,
          avatarUrl: p.profile.avatarUrl,
          position: {
            x: Math.cos(angle) * radius,
            y: 0,
            z: Math.sin(angle) * radius,
          },
          rotation: angle + Math.PI, // 중앙을 바라보도록
          animation: "idle" as const,
          isTalking: false,
        };
      },
    );

    // 테이블 배치 (2인 1조)
    const tables = [];
    for (let i = 0; i < participants.length; i += 2) {
      const pair = participants.slice(i, i + 2);
      if (pair.length >= 2) {
        const tableAngle = (i / 2 / Math.ceil(participants.length / 2)) * Math.PI * 2;
        const tableRadius = 3;
        tables.push({
          tableId: `table-${i / 2}`,
          position: {
            x: Math.cos(tableAngle) * tableRadius,
            y: 0,
            z: Math.sin(tableAngle) * tableRadius,
          },
          participantIds: pair.map((p) => p.profileId),
        });
      }
    }

    return {
      partyId: party.id,
      status: "waiting",
      currentRound: 0,
      totalRounds: party.roundCount,
      participants,
      tables,
    };
  }

  // 시뮬레이션 실행
  private async startSimulation(partyId: string, party: any) {
    const state = this.partyStates.get(partyId);
    if (!state) return;

    state.status = "running";
    this.server.to(`party:${partyId}`).emit("partyState", state);

    // 라운드 진행
    for (let round = 1; round <= party.roundCount; round++) {
      state.currentRound = round;

      // 라운드 시작 알림
      this.server.to(`party:${partyId}`).emit("roundStart", {
        round,
        totalRounds: party.roundCount,
      });

      // 참가자 테이블로 이동
      await this.moveParticipantsToTables(partyId, state);

      // 대화 시뮬레이션
      await this.simulateConversations(partyId, state, round);

      // 라운드 종료
      this.server.to(`party:${partyId}`).emit("roundEnd", { round });

      // 다음 라운드 전 대기 (라운드 간 셔플 애니메이션용)
      if (round < party.roundCount) {
        await this.delay(3000);
        this.shuffleTables(state);
      }
    }

    // 파티 완료
    state.status = "completed";
    this.server.to(`party:${partyId}`).emit("partyCompleted", state);

    // DB 업데이트
    await this.prisma.party.update({
      where: { id: partyId },
      data: { status: "completed" },
    });

    // 클라이언트가 partyCompleted 수신 후 30초 뒤 메모리 해제
    setTimeout(() => this.partyStates.delete(partyId), 30_000);
  }

  // 참가자들을 테이블로 이동
  private async moveParticipantsToTables(partyId: string, state: PartyState) {
    for (const table of state.tables) {
      for (let i = 0; i < table.participantIds.length; i++) {
        const participant = state.participants.find(
          (p) => p.profileId === table.participantIds[i],
        );
        if (participant) {
          // 테이블 주변 위치 계산
          const offset = i === 0 ? -0.8 : 0.8;
          participant.animation = "walking";

          // 이동 애니메이션 (프론트엔드에서 보간)
          const targetPosition = {
            x: table.position.x + offset,
            y: 0,
            z: table.position.z,
          };

          this.server.to(`party:${partyId}`).emit("participantMove", {
            profileId: participant.profileId,
            targetPosition,
            duration: 2000,
          });

          participant.position = targetPosition;
          participant.rotation = i === 0 ? 0 : Math.PI; // 서로 마주보기
        }
      }
    }

    await this.delay(2500);

    // 모두 idle 상태로
    state.participants.forEach((p) => (p.animation = "idle"));
    this.server.to(`party:${partyId}`).emit("partyState", state);
  }

  // 대화 시뮬레이션 — 모든 테이블 병렬 진행
  private async simulateConversations(
    partyId: string,
    state: PartyState,
    round: number,
  ) {
    const conversationsPerRound = 6;

    await Promise.all(
      state.tables.map(async (table) => {
        const participants = table.participantIds
          .map((id) => state.participants.find((p) => p.profileId === id))
          .filter(Boolean) as ParticipantState[];

        if (participants.length < 2) return;

        const icebreaker = ICEBREAKERS[(round - 1) % ICEBREAKERS.length];

        this.server.to(`party:${partyId}`).emit("systemMessage", {
          tableId: table.tableId,
          message: `💬 ${icebreaker}`,
        });

        await this.delay(2000);

        for (let i = 0; i < conversationsPerRound; i++) {
          const speaker = participants[i % 2];
          const listener = participants[(i + 1) % 2];

          const message = this.generateConversation(speaker, listener, i);

          speaker.isTalking = true;
          speaker.animation = "talking";
          speaker.currentMessage = message.message;

          this.server.to(`party:${partyId}`).emit("conversation", {
            tableId: table.tableId,
            speaker: { profileId: speaker.profileId, name: speaker.name },
            message: message.message,
            emotion: message.emotion,
            timestamp: Date.now(),
          });

          this.server.to(`party:${partyId}`).emit("participantUpdate", {
            profileId: speaker.profileId,
            changes: { isTalking: true, animation: "talking", currentMessage: message.message },
          });

          const speakDuration = Math.max(2000, message.message.length * 80);
          await this.delay(speakDuration);

          speaker.isTalking = false;
          speaker.animation = "idle";
          speaker.currentMessage = undefined;

          this.server.to(`party:${partyId}`).emit("participantUpdate", {
            profileId: speaker.profileId,
            changes: { isTalking: false, animation: "idle", currentMessage: null },
          });

          await this.delay(500);
        }
      }),
    );
  }

  // 대화 생성 (간단한 템플릿 기반)
  private generateConversation(
    speaker: ParticipantState,
    listener: ParticipantState,
    turnIndex: number,
  ): ConversationMessage {
    const topics = ["여행", "음식", "취미", "음악", "영화", "운동"];
    const topic = topics[turnIndex % topics.length];

    const template =
      CONVERSATION_TEMPLATES[turnIndex % CONVERSATION_TEMPLATES.length];
    const message = template.template.replace("{topic}", topic);

    // 첫 대화는 자기 소개
    if (turnIndex === 0) {
      return {
        speakerId: speaker.profileId,
        speakerName: speaker.name,
        message: `안녕하세요! 저는 ${speaker.name}이에요. 반가워요!`,
        timestamp: Date.now(),
        emotion: "happy",
      };
    }

    if (turnIndex === 1) {
      return {
        speakerId: speaker.profileId,
        speakerName: speaker.name,
        message: `반가워요, ${listener.name}님! 저도 ${speaker.name}이라고 해요.`,
        timestamp: Date.now(),
        emotion: "happy",
      };
    }

    return {
      speakerId: speaker.profileId,
      speakerName: speaker.name,
      message,
      timestamp: Date.now(),
      emotion: template.emotion as ConversationMessage["emotion"],
    };
  }

  // 테이블 셔플 (다음 라운드용)
  private shuffleTables(state: PartyState) {
    const profileIds = state.participants.map((p) => p.profileId);

    // Fisher-Yates 셔플
    for (let i = profileIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [profileIds[i], profileIds[j]] = [profileIds[j], profileIds[i]];
    }

    // 새 테이블 배정
    let idx = 0;
    for (const table of state.tables) {
      table.participantIds = [];
      for (let i = 0; i < 2 && idx < profileIds.length; i++, idx++) {
        table.participantIds.push(profileIds[idx]);
      }
    }
  }

  // 딜레이 유틸리티
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 파티 상태 조회
  getPartyState(partyId: string): PartyState | undefined {
    return this.partyStates.get(partyId);
  }

  // 시뮬레이션 중지
  stopSimulation(partyId: string) {
    const interval = this.partyIntervals.get(partyId);
    if (interval) {
      clearInterval(interval);
      this.partyIntervals.delete(partyId);
    }

    const state = this.partyStates.get(partyId);
    if (state) {
      state.status = "paused";
      this.server.to(`party:${partyId}`).emit("partyPaused", state);
    }
  }
}
