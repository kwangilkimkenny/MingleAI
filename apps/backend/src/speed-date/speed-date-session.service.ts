import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MatchService } from "../match/match.service";
import { SpeedDateConfigProvider } from "./speed-date.config";
import {
  createInitialState,
  isOppositeGender,
  mutualPairs,
  nextPhase,
  type SpeedDateParticipant,
  type SpeedDateResult,
  type SpeedDateState,
} from "./speed-date.state";

/** An `ai-` prefixed profile id is a dev-only AI-filled slot with no real profile row. */
export function isAiProfileId(id: string): boolean {
  return id.startsWith("ai-");
}

/** Fisher-Yates copy shuffle — randomizes session pairings (see createSession). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface AdvanceOutcome {
  sessionId: string;
  transitioned: boolean;
  state: SpeedDateState;
}

@Injectable()
export class SpeedDateSessionService {
  private readonly log = new Logger(SpeedDateSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configProvider: SpeedDateConfigProvider,
    private readonly match: MatchService,
  ) {}

  private get cfg() {
    return this.configProvider.value;
  }

  /** Load the state JSON of any session (active or ended); null if not found. */
  async loadState(sessionId: string): Promise<SpeedDateState | null> {
    const row = await this.prisma.speedDateSession.findUnique({ where: { id: sessionId } });
    return row ? (row.state as unknown as SpeedDateState) : null;
  }

  /** Resolve the caller's profile id if they are a participant of the session, else null. */
  async assertParticipant(userId: string, sessionId: string): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return null;
    const state = await this.loadState(sessionId);
    if (!state) return null;
    return state.participants.some((p) => p.profileId === profile.id) ? profile.id : null;
  }

  /**
   * Create a session: atomically claim the real queue entries (waiting → matched), build the
   * state, and stamp `matchedSessionId`. AI-filled participants have no queue entry. Returns the
   * new session id, or null if a concurrent sweep already claimed an entry.
   */
  async createSession(
    realEntryIds: string[],
    participants: SpeedDateParticipant[],
    males: string[],
    females: string[],
    now: Date,
  ): Promise<string | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            for (const id of realEntryIds) {
              const claimed = await tx.speedDateQueueEntry.updateMany({
                where: { id, status: "waiting" },
                data: { status: "matched" },
              });
              if (claimed.count === 0) throw new Error("entry already claimed");
            }
            const session = await tx.speedDateSession.create({
              data: {
                status: "active",
                // Shuffle each gender's ids so the rotation pairings vary per session (random
                // matching); buildRotationSchedule keeps the round-robin invariant (each person
                // still meets every opposite-gender partner exactly once per stage).
                state: createInitialState(
                  participants,
                  shuffle(males),
                  shuffle(females),
                  this.cfg,
                  now.getTime(),
                ) as unknown as Prisma.InputJsonValue,
              },
            });
            if (realEntryIds.length > 0) {
              await tx.speedDateQueueEntry.updateMany({
                where: { id: { in: realEntryIds } },
                data: { matchedSessionId: session.id },
              });
            }
            return session.id;
          },
          { isolationLevel: "Serializable" },
        );
      } catch (e) {
        const code = (e as { code?: string }).code;
        if ((code === "P2034" || code === "P2002") && attempt < MAX_ATTEMPTS) continue;
        this.log.warn(`createSession rolled back: ${(e as Error).message}`);
        return null;
      }
    }
  }

  /** Submit or clear one private choice. The server enforces the product's single-pick contract. */
  async choose(
    sessionId: string,
    chooserId: string,
    targetId: string,
    on: boolean,
  ): Promise<SpeedDateState | null> {
    // The whole session lives in one `state` JSON, so a plain read-modify-write loses updates
    // when choices race — which they do constantly with 6 people picking in the decision window.
    // Serialize the RMW in a Serializable tx with P2034 retry so concurrent choices are applied
    // one-on-top-of-another. An "on" submission replaces the chooser's previous target atomically.
    const MAX_ATTEMPTS = 6;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const row = await tx.speedDateSession.findFirst({
              where: { id: sessionId, status: "active" },
            });
            if (!row) return null;
            const state = row.state as unknown as SpeedDateState;
            if (state.phase === "ended") return null;
            if (!state.participants.some((p) => p.profileId === chooserId)) return null;
            if (!state.participants.some((p) => p.profileId === targetId)) return null;
            if (!isOppositeGender(state, chooserId, targetId)) return null;

            state.choices[chooserId] = on
              ? [targetId]
              : (state.choices[chooserId] ?? []).filter((id) => id !== targetId);

            await tx.speedDateSession.update({
              where: { id: sessionId },
              data: { state: state as unknown as Prisma.InputJsonValue },
            });
            return state;
          },
          { isolationLevel: "Serializable" },
        );
      } catch (e) {
        const code = (e as { code?: string }).code;
        if ((code === "P2034" || code === "P2002") && attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 15 * attempt));
          continue;
        }
        throw e;
      }
    }
  }

  /** Advance one active session if its phase deadline passed; resolves the decision on end. */
  async advance(sessionId: string, now: Date): Promise<AdvanceOutcome | null> {
    const row = await this.prisma.speedDateSession.findFirst({
      where: { id: sessionId, status: "active" },
    });
    if (!row) return null;
    const state = row.state as unknown as SpeedDateState;
    const advanced = nextPhase(state, now.getTime(), this.cfg);
    if (!advanced) return { sessionId, transitioned: false, state };

    if (advanced.phase === "ended") {
      advanced.result = await this.resolveDecision(advanced);
      await this.prisma.speedDateSession.update({
        where: { id: sessionId },
        data: {
          state: advanced as unknown as Prisma.InputJsonValue,
          status: "ended",
          endedAt: now,
          result: (advanced.result ?? {}) as unknown as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.speedDateSession.update({
        where: { id: sessionId },
        data: { state: advanced as unknown as Prisma.InputJsonValue },
      });
    }
    return { sessionId, transitioned: true, state: advanced };
  }

  /** Advance every active session; returns outcomes for the gateway to broadcast. */
  async advanceAllActive(now: Date): Promise<AdvanceOutcome[]> {
    const rows = await this.prisma.speedDateSession.findMany({
      where: { status: "active" },
      select: { id: true },
    });
    const out: AdvanceOutcome[] = [];
    for (const { id } of rows) {
      try {
        const res = await this.advance(id, now);
        if (res) out.push(res);
      } catch (e) {
        this.log.warn(`advance ${id} failed: ${(e as Error).message}`);
      }
    }
    return out;
  }

  /** Turn mutual choices into real Match + DM rooms (skipping AI slots and blocked pairs). */
  async resolveDecision(state: SpeedDateState): Promise<SpeedDateResult> {
    const matches: SpeedDateResult["matches"] = [];
    for (const [a, b] of mutualPairs(state)) {
      if (isAiProfileId(a) || isAiProfileId(b)) continue;
      const link = await this.match.createMatch(a, b);
      if (link) matches.push({ a, b, matchId: link.matchId, roomId: link.roomId });
    }
    return { matches };
  }
}
