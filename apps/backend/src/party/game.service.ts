import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { GameChoice, GameReveal, GameSnapshot } from "@mingle/shared";

export const QUESTIONS: { a: string; b: string }[] = [
  { a: "산으로 여행", b: "바다로 여행" },
  { a: "아침형 인간", b: "저녁형 인간" },
  { a: "영화관 데이트", b: "산책 데이트" },
  { a: "매운 음식", b: "단 음식" },
  { a: "강아지", b: "고양이" },
  { a: "계획적인 여행", b: "즉흥 여행" },
  { a: "전화 통화", b: "문자 메시지" },
  { a: "집에서 쉬기", b: "밖에서 놀기" },
  { a: "겨울", b: "여름" },
  { a: "혼자 취미", b: "함께 취미" },
  { a: "일찍 자고 일찍 일어나기", b: "늦게 자고 늦잠" },
  { a: "노래방", b: "보드게임 카페" },
];

export const TOTAL_ROUNDS = 5;

interface GameState {
  order: number[];
  round: number;
  votes: Record<string, Record<string, GameChoice>>;
  reveals: GameReveal[];
}

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async start(partyId: string): Promise<GameSnapshot> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockParty(tx, partyId);
        const active = await this.findActive(tx, partyId);
        if (active) throw new ConflictException("already-active");
        const order = shuffle([...QUESTIONS.keys()]).slice(0, TOTAL_ROUNDS);
        const state: GameState = { order, round: 0, votes: {}, reveals: [] };
        const row = await tx.gameSession.create({
          data: { partyId, gameType: "balance", status: "active", state: state as unknown as object },
        });
        return this.toSnapshot(row.id, "active", state);
      });
    } catch (e) {
      // DB backstop behind the advisory lock: the partial-unique index
      // (game_sessions_party_active_key) rejects a concurrent start that somehow raced past the
      // lock as P2002 → surface it as the same "already-active" conflict, not a raw 500.
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("already-active");
      throw e;
    }
  }

  async vote(
    partyId: string,
    profileId: string,
    choice: GameChoice,
    presentMembers: string[],
  ): Promise<GameSnapshot> {
    if (choice !== "a" && choice !== "b") throw new BadRequestException("invalid");
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);
      const row = await this.findActive(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");
      const state = row.state as unknown as GameState;
      const key = String(state.round);
      state.votes[key] = { ...(state.votes[key] ?? {}), [profileId]: choice };
      const votes = state.votes[key];
      const everyoneVoted =
        presentMembers.length > 0 && presentMembers.every((pid) => votes[pid] !== undefined);
      let status: "active" | "ended" = "active";
      if (everyoneVoted) {
        const q = QUESTIONS[state.order[state.round]!]!;
        state.reveals.push({
          round: state.round,
          question: q,
          aVoters: Object.keys(votes).filter((p) => votes[p] === "a"),
          bVoters: Object.keys(votes).filter((p) => votes[p] === "b"),
        });
        state.round += 1;
        if (state.round >= TOTAL_ROUNDS) status = "ended";
      }
      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          status,
          ...(status === "ended"
            ? { endedAt: new Date(), result: state.reveals as unknown as object }
            : {}),
        },
      });
      return this.toSnapshot(row.id, status, state);
    });
  }

  async end(partyId: string): Promise<GameSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);
      const row = await this.findActive(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");
      const state = row.state as unknown as GameState;
      await tx.gameSession.update({
        where: { id: row.id },
        data: { status: "ended", endedAt: new Date(), result: state.reveals as unknown as object },
      });
      return this.toSnapshot(row.id, "ended", state);
    });
  }

  async current(partyId: string): Promise<GameSnapshot | null> {
    const row = await this.findActive(this.prisma, partyId);
    if (!row) return null;
    return this.toSnapshot(row.id, "active", row.state as unknown as GameState);
  }

  /**
   * Transaction-scoped Postgres advisory lock keyed by partyId. Serializes ALL game-state
   * transitions (start/vote/end) for a party so concurrent votes can't lost-update or
   * double-advance the GameSession.state blob, and two concurrent starts can't create two
   * active sessions. The lock auto-releases at commit/rollback. Migration-free.
   */
  private lockParty(tx: Prisma.TransactionClient, partyId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${partyId})::bigint)`;
  }

  private findActive(client: Prisma.TransactionClient, partyId: string) {
    return client.gameSession.findFirst({ where: { partyId, status: "active" } });
  }

  private toSnapshot(
    sessionId: string,
    status: "active" | "ended",
    state: GameState,
  ): GameSnapshot {
    const ended = status === "ended" || state.round >= TOTAL_ROUNDS;
    const qIdx = ended ? undefined : state.order[state.round];
    return {
      sessionId,
      gameType: "balance",
      status: ended ? "ended" : "active",
      round: state.round,
      totalRounds: TOTAL_ROUNDS,
      question: qIdx === undefined ? null : (QUESTIONS[qIdx] ?? null),
      votedProfileIds: Object.keys(state.votes[String(state.round)] ?? {}),
      reveals: state.reveals,
    };
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
