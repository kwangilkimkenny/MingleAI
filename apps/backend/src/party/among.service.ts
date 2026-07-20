import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AmongConfigProvider } from "./among.config";
import type { AmongRole, AmongTaskKind, AmongResultView, AmongSnapshot } from "@mingle/shared";
import { PARTY_MAP } from "@mingle/shared";
import { pickPersonas } from "./ai/personas";

// ---------------------------------------------------------------------------
// Server-only authoritative state (stored in GameSession.state Json column)
// ---------------------------------------------------------------------------

export interface AmongState {
  sessionId: string;
  players: {
    profileId: string;
    name: string;
    role: AmongRole;
    alive: boolean;
    isBot: boolean;
    /** 인간은 항상 false — 임포스터는 AI 페르소나 전용(2026-07-20 스펙). */
    isAi: boolean;
    killCooldownUntil: number | null;
    emergencyUsed: number;
  }[];
  tasks: {
    taskId: string;
    profileId: string;
    kind: AmongTaskKind;
    x: number;
    y: number;
    done: boolean;
  }[];
  bodies: { profileId: string; x: number; y: number; reported: boolean }[];
  meeting: {
    reason: "report" | "emergency";
    calledBy: string;
    bodyProfileId?: string;
    discussionEndsAt: number;
    voteEndsAt: number;
    votes: Record<string, string>;
  } | null;
  lastEjected: { profileId: string; role: AmongRole; wasSkip: boolean } | null;
  phase: "playing" | "meeting" | "voting" | "ended";
  result: AmongResultView | null;
  /** 다음 자동(정기) 회의 예정 시각(epoch ms). */
  nextAutoMeetingAt: number;
  /** AI 임포스터 봇 런타임 상태 — LLM 호출 예산 및 페르소나별 이동/발화/킬 타이밍. */
  ai: {
    llmCalls: number;
    bots: Record<
      string,
      {
        x: number;
        y: number;
        targetIdx: number;
        nextChatAt: number;
        killHoldUntil: number;
        /** 페르소나 원본 — 이후 LLM 발화(sayAsAi/castAiVote)가 사용. */
        persona: { age: number; gender: "male" | "female"; occupation: string; style: string };
      }
    >;
  };
}

const KINDS: AmongTaskKind[] = ["wires", "sequence", "hold", "timing"];

// ---------------------------------------------------------------------------
// AmongService
// ---------------------------------------------------------------------------

@Injectable()
export class AmongService {
  constructor(
    private prisma: PrismaService,
    private config: AmongConfigProvider,
  ) {}

  // -------------------------------------------------------------------------
  // start
  // -------------------------------------------------------------------------

  async start(
    partyId: string,
    roster: { profileId: string; isBot?: boolean }[],
    opts: { llmEnabled?: boolean } = {},
  ): Promise<AmongState> {
    // Gate before we ever enter the transaction — AI impostors need a working LLM
    // (unless the deployment explicitly allows the no-LLM fallback via config).
    if (this.config.value.aiRequireLlm && !opts.llmEnabled) {
      throw new BadRequestException("ai-unavailable");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockParty(tx, partyId);

        const any = await this.findActiveAny(tx, partyId);
        if (any) throw new ConflictException("already-active");

        const cfg = this.config.value;
        if (roster.length < cfg.minPlayers) {
          throw new BadRequestException("not-enough-players");
        }

        // Fetch player names
        const rosterIds = roster.map((r) => r.profileId);
        const profiles = await tx.profile.findMany({
          where: { id: { in: rosterIds } },
          select: { id: true, name: true },
        });
        const nameById = new Map(profiles.map((p) => [p.id, p.name]));

        // 인간은 전원 crew — 임포스터는 AI 페르소나 전용(2026-07-20 스펙).
        const humans: AmongState["players"] = roster.map((r) => ({
          profileId: r.profileId,
          name: nameById.get(r.profileId) ?? "익명",
          role: "crew",
          alive: true,
          isBot: r.isBot ?? false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        }));
        const personas = pickPersonas(cfg.aiCount, new Set(humans.map((h) => h.name)));
        const now = Date.now();
        const ais: AmongState["players"] = personas.map((p) => ({
          profileId: p.profileId,
          name: p.name,
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: now + cfg.killCooldownMs,
          emergencyUsed: 0,
        }));
        const players = [...humans, ...ais];

        // Build tasks: each crew player (human) gets cfg.tasksPerCrew tasks,
        // placed on shuffled PARTY_MAP station anchors (round-robin if tasks > stations).
        // AI impostors are never crew, so they never receive tasks.
        const stationPool = shuffle([...PARTY_MAP.stations]);
        const tasks: AmongState["tasks"] = [];
        let taskCounter = 0;
        for (const player of players) {
          if (player.role !== "crew") continue;
          for (let i = 0; i < cfg.tasksPerCrew; i++) {
            const station = stationPool[taskCounter % stationPool.length]!;
            tasks.push({
              taskId: `${player.profileId}:${i}`,
              profileId: player.profileId,
              kind: KINDS[taskCounter % 4]!,
              x: station.x,
              y: station.y,
              done: false,
            });
            taskCounter++;
          }
        }

        const state: AmongState = {
          sessionId: "", // filled after create
          phase: "playing",
          players,
          tasks,
          bodies: [],
          meeting: null,
          lastEjected: null,
          result: null,
          nextAutoMeetingAt: now + cfg.autoMeetingMs,
          ai: {
            llmCalls: 0,
            bots: Object.fromEntries(
              personas.map((p, i) => {
                const st = PARTY_MAP.stations[i % PARTY_MAP.stations.length]!;
                return [
                  p.profileId,
                  {
                    x: st.x,
                    y: st.y,
                    targetIdx: (i + 1) % PARTY_MAP.stations.length,
                    nextChatAt: now + 15000 + i * 7000,
                    killHoldUntil: now + 20000,
                    persona: {
                      age: p.age,
                      gender: p.gender,
                      occupation: p.occupation,
                      style: p.style,
                    },
                  },
                ];
              }),
            ),
          },
        };

        const row = await tx.gameSession.create({
          data: {
            partyId,
            gameType: "among",
            status: "active",
            state: state as unknown as object,
          },
        });

        // Embed the real sessionId
        state.sessionId = row.id;
        await tx.gameSession.update({
          where: { id: row.id },
          data: { state: state as unknown as object },
        });

        return state;
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictException("already-active");
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // doTask
  // -------------------------------------------------------------------------

  async doTask(partyId: string, profileId: string, taskId: string): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;

      if (state.phase !== "playing") throw new BadRequestException("invalid");

      const task = state.tasks.find(
        (t) => t.taskId === taskId && t.profileId === profileId && !t.done,
      );
      if (!task) throw new BadRequestException("invalid");

      task.done = true;

      // Check if all crew tasks are done → crew wins
      const allDone = this.crewTasksDone(state);
      let status: "active" | "ended" = "active";
      if (allDone) {
        state.result = { winner: "crew", reason: "tasks" };
        state.phase = "ended";
        status = "ended";
      }

      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          status,
          ...(status === "ended"
            ? { endedAt: new Date(), result: state.result as unknown as object }
            : {}),
        },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // current (lock-free)
  // -------------------------------------------------------------------------

  async current(partyId: string): Promise<AmongState | null> {
    const row = await this.findActiveAmong(this.prisma, partyId);
    if (!row) return null;
    return row.state as unknown as AmongState;
  }

  /**
   * The most recent among session for a party REGARDLESS of status (active or ended).
   * Lock-free read. Used so the gateway can broadcast the final result after a
   * sweep- or vote-driven game-over (when `current()` returns null because the row
   * is no longer "active"), and so a late `among:sync` still shows the result screen.
   */
  async latestAmong(partyId: string): Promise<AmongState | null> {
    const row = await this.prisma.gameSession.findFirst({
      where: { partyId, gameType: "among" },
      orderBy: { startedAt: "desc" },
    });
    if (!row) return null;
    return row.state as unknown as AmongState;
  }

  // -------------------------------------------------------------------------
  // end
  // -------------------------------------------------------------------------

  async end(partyId: string): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;
      state.phase = "ended";
      // preserve existing result, or leave null
      state.result = state.result ?? null;

      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          status: "ended",
          endedAt: new Date(),
          result: (state.result ?? null) as unknown as object,
        },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // kill
  // -------------------------------------------------------------------------

  async kill(
    partyId: string,
    profileId: string,
    targetProfileId: string,
    x: number,
    y: number,
  ): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;

      if (state.phase !== "playing") throw new BadRequestException("invalid");

      const caller = state.players.find((p) => p.profileId === profileId);
      if (!caller || !caller.alive || caller.role !== "impostor") {
        throw new BadRequestException("invalid");
      }

      const now = Date.now();
      if (caller.killCooldownUntil !== null && caller.killCooldownUntil > now) {
        throw new BadRequestException("invalid");
      }

      const target = state.players.find((p) => p.profileId === targetProfileId);
      if (!target || !target.alive || target.role === "impostor") {
        throw new BadRequestException("invalid");
      }

      // Apply kill
      target.alive = false;
      state.bodies.push({ profileId: targetProfileId, x, y, reported: false });
      caller.killCooldownUntil = now + this.config.value.killCooldownMs;

      // Win check: impostor parity, then crew-tasks (the victim's pending tasks no
      // longer count, so a kill can complete the crew's task requirement).
      let status: "active" | "ended" = "active";
      if (this.impostorParity(state)) {
        state.result = { winner: "impostor", reason: "kills" };
        state.phase = "ended";
        status = "ended";
      } else if (this.crewTasksDone(state)) {
        state.result = { winner: "crew", reason: "tasks" };
        state.phase = "ended";
        status = "ended";
      }

      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          status,
          ...(status === "ended"
            ? { endedAt: new Date(), result: state.result as unknown as object }
            : {}),
        },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // report
  // -------------------------------------------------------------------------

  async report(partyId: string, profileId: string, bodyProfileId: string): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;

      if (state.phase !== "playing") throw new BadRequestException("invalid");

      const caller = state.players.find((p) => p.profileId === profileId);
      if (!caller || !caller.alive) throw new BadRequestException("invalid");

      const body = state.bodies.find((b) => b.profileId === bodyProfileId && b.reported === false);
      if (!body) throw new BadRequestException("invalid");

      body.reported = true;

      const now = Date.now();
      state.meeting = {
        reason: "report",
        calledBy: profileId,
        bodyProfileId,
        discussionEndsAt: now + this.config.value.discussionMs,
        voteEndsAt: now + this.config.value.discussionMs + this.config.value.voteMs,
        votes: {},
      };
      state.phase = "meeting";

      await tx.gameSession.update({
        where: { id: row.id },
        data: { state: state as unknown as object },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // emergency
  // -------------------------------------------------------------------------

  async emergency(partyId: string, profileId: string): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;

      if (state.phase !== "playing") throw new BadRequestException("invalid");

      const caller = state.players.find((p) => p.profileId === profileId);
      if (!caller || !caller.alive) throw new BadRequestException("invalid");
      if (caller.emergencyUsed >= this.config.value.emergencyPerPlayer) {
        throw new BadRequestException("invalid");
      }

      caller.emergencyUsed += 1;

      const now = Date.now();
      state.meeting = {
        reason: "emergency",
        calledBy: profileId,
        discussionEndsAt: now + this.config.value.discussionMs,
        voteEndsAt: now + this.config.value.discussionMs + this.config.value.voteMs,
        votes: {},
      };
      state.phase = "meeting";

      await tx.gameSession.update({
        where: { id: row.id },
        data: { state: state as unknown as object },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // vote
  // -------------------------------------------------------------------------

  async vote(partyId: string, profileId: string, target: string): Promise<AmongState> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockParty(tx, partyId);

      const row = await this.findActiveAmong(tx, partyId);
      if (!row) throw new NotFoundException("no-active-game");

      const state = row.state as unknown as AmongState;

      if (state.phase !== "voting") throw new BadRequestException("invalid");

      const caller = state.players.find((p) => p.profileId === profileId);
      if (!caller || !caller.alive) throw new BadRequestException("invalid");
      if (state.meeting!.votes[profileId] !== undefined) throw new BadRequestException("invalid");

      state.meeting!.votes[profileId] = target;

      // If every alive player has voted, resolve the meeting
      const alivePlayers = state.players.filter((p) => p.alive);
      const everyoneVoted = alivePlayers.every(
        (p) => state.meeting!.votes[p.profileId] !== undefined,
      );
      if (everyoneVoted) {
        this.resolveMeeting(state);
      }

      const status: "active" | "ended" =
        (state.phase as AmongState["phase"]) === "ended" ? "ended" : "active";

      await tx.gameSession.update({
        where: { id: row.id },
        data: {
          state: state as unknown as object,
          status,
          ...(status === "ended"
            ? { endedAt: new Date(), result: state.result as unknown as object }
            : {}),
        },
      });

      return state;
    });
  }

  // -------------------------------------------------------------------------
  // sweepMeetings
  // -------------------------------------------------------------------------

  async sweepMeetings(): Promise<string[]> {
    const rows = await this.prisma.gameSession.findMany({
      where: { status: "active", gameType: "among" },
    });

    const advanced: string[] = [];

    for (const row of rows) {
      const outerState = row.state as unknown as AmongState;
      const now = Date.now();

      const needsAdvance =
        (outerState.phase === "meeting" &&
          outerState.meeting !== null &&
          now >= outerState.meeting.discussionEndsAt) ||
        (outerState.phase === "voting" &&
          outerState.meeting !== null &&
          now >= outerState.meeting.voteEndsAt);

      if (!needsAdvance) continue;

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.lockParty(tx, row.partyId);

          const fresh = await this.findActiveAmong(tx, row.partyId);
          if (!fresh) return; // already ended by someone else

          const state = fresh.state as unknown as AmongState;
          const txNow = Date.now();

          // Re-check conditions inside the tx
          if (
            state.phase === "meeting" &&
            state.meeting !== null &&
            txNow >= state.meeting.discussionEndsAt
          ) {
            state.phase = "voting";
          } else if (
            state.phase === "voting" &&
            state.meeting !== null &&
            txNow >= state.meeting.voteEndsAt
          ) {
            this.resolveMeeting(state);
          } else {
            // condition no longer holds (race guard)
            return;
          }

          const status: "active" | "ended" =
            (state.phase as AmongState["phase"]) === "ended" ? "ended" : "active";

          await tx.gameSession.update({
            where: { id: fresh.id },
            data: {
              state: state as unknown as object,
              status,
              ...(status === "ended"
                ? { endedAt: new Date(), result: state.result as unknown as object }
                : {}),
            },
          });

          advanced.push(row.partyId);
        });
      } catch {
        // Skip rows that errored — don't let one bad row block others
      }
    }

    return advanced;
  }

  // -------------------------------------------------------------------------
  // project — pure, no DB, no lock
  // -------------------------------------------------------------------------

  project(state: AmongState | null, viewerProfileId: string): AmongSnapshot | null {
    if (state === null) return null;

    const myPlayer = state.players.find((p) => p.profileId === viewerProfileId);
    const isEnded = state.phase === "ended";

    const players = state.players.map((p) => ({
      profileId: p.profileId,
      name: p.name,
      alive: p.alive,
      role: isEnded || p.profileId === viewerProfileId ? p.role : null,
      // isAi는 게임 종료 전까지 노출 금지(임포스터 정체 유추 방지) — ended에서만 세팅.
      ...(isEnded && p.isAi ? { isAi: true } : {}),
    }));

    const myTasks = state.tasks
      .filter((t) => t.profileId === viewerProfileId)
      .map((t) => ({ taskId: t.taskId, kind: t.kind, x: t.x, y: t.y, done: t.done }));

    // Progress counts only tasks the crew can still be required to finish — dead
    // players' tasks are excluded from both sides (they can't act; see crewTasksDone).
    const aliveIds = new Set(state.players.filter((p) => p.alive).map((p) => p.profileId));
    const requiredTasks = state.tasks.filter((t) => aliveIds.has(t.profileId));
    const progress = {
      done: requiredTasks.filter((t) => t.done).length,
      total: requiredTasks.length,
    };

    const bodies = state.bodies.map((b) => ({
      profileId: b.profileId,
      x: b.x,
      y: b.y,
    }));

    let meeting: AmongSnapshot["meeting"] = null;
    if (state.meeting) {
      const m = state.meeting;
      meeting = {
        reason: m.reason,
        calledBy: m.calledBy,
        bodyProfileId: m.bodyProfileId,
        phase: state.phase === "voting" ? "voting" : "discussion",
        endsAt: state.phase === "voting" ? m.voteEndsAt : m.discussionEndsAt,
        votedProfileIds: Object.keys(m.votes),
      };
    }

    return {
      sessionId: state.sessionId,
      phase: state.phase,
      myRole: myPlayer?.role ?? null,
      myProfileId: viewerProfileId,
      players,
      myTasks,
      progress,
      bodies,
      killCooldownUntil: myPlayer?.killCooldownUntil ?? null,
      meeting,
      lastEjected: state.lastEjected,
      result: state.result,
      // 구 세션(마이그레이션 이전) 방어 — 필드 부재 시 undefined가 아닌 null로 정규화.
      nextAutoMeetingAt: state.phase === "playing" ? (state.nextAutoMeetingAt ?? null) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Count of alive impostors. */
  /**
   * Crew task win: every task owned by a LIVING player is done. Dead players can't act
   * (no ghost task play), so their pending tasks must not block the win — otherwise a
   * passive impostor deadlocks the game (QA ISSUE-002).
   */
  private crewTasksDone(state: AmongState): boolean {
    // No task system in play (empty tasks) → never a task win; vacuous truth would
    // otherwise end the game on the first kill/meeting in task-less states.
    if (state.tasks.length === 0) return false;
    const alive = new Set(state.players.filter((p) => p.alive).map((p) => p.profileId));
    return state.tasks.every((t) => t.done || !alive.has(t.profileId));
  }

  private aliveImpostors(state: AmongState): number {
    return state.players.filter((p) => p.role === "impostor" && p.alive).length;
  }

  /** Count of alive crew (role !== "impostor" && alive). */
  private aliveCrew(state: AmongState): number {
    return state.players.filter((p) => p.role !== "impostor" && p.alive).length;
  }

  /** True if impostors >= crew and at least one impostor alive. */
  private impostorParity(state: AmongState): boolean {
    const ai = this.aliveImpostors(state);
    return ai > 0 && ai >= this.aliveCrew(state);
  }

  /**
   * Mutates state: tallies votes, ejects the unique plurality non-skip target (if any),
   * then checks win conditions. If game continues, resets meeting and impostor cooldowns.
   * Does NOT touch the DB.
   */
  private resolveMeeting(state: AmongState): void {
    const votes = state.meeting!.votes;
    const tally: Record<string, number> = {};
    for (const v of Object.values(votes)) {
      tally[v] = (tally[v] ?? 0) + 1;
    }

    const maxCount = Math.max(0, ...Object.values(tally));
    const topTargets = Object.keys(tally).filter((k) => tally[k] === maxCount);
    const nonSkipTop = topTargets.filter((t) => t !== "skip");

    let ejectedId: string | null = null;
    let ejectedRole: AmongRole = "crew";

    if (nonSkipTop.length === 1 && (tally["skip"] ?? 0) < maxCount) {
      // Unique non-skip plurality winner
      ejectedId = nonSkipTop[0]!;
      const ejectedPlayer = state.players.find((p) => p.profileId === ejectedId);
      if (ejectedPlayer) {
        ejectedPlayer.alive = false;
        ejectedRole = ejectedPlayer.role;
      }
      state.lastEjected = { profileId: ejectedId, role: ejectedRole, wasSkip: false };
    } else {
      // Tie, skip wins, or no votes
      state.lastEjected = { profileId: "", role: "crew", wasSkip: true };
    }

    // Win checks. On game-end, clear the meeting so the `ended` snapshot never carries a
    // stale meeting object (a non-null meeting after end would make clients keying off
    // `meeting !== null` render a discussion/vote screen post-game).
    if (this.aliveImpostors(state) === 0) {
      state.result = { winner: "crew", reason: "ejected" };
      state.phase = "ended";
      state.meeting = null;
      return;
    }
    if (this.impostorParity(state)) {
      state.result = { winner: "impostor", reason: "kills" };
      state.phase = "ended";
      state.meeting = null;
      return;
    }
    if (this.crewTasksDone(state)) {
      // An ejected crew's pending tasks no longer count — the requirement may now be met.
      state.result = { winner: "crew", reason: "tasks" };
      state.phase = "ended";
      state.meeting = null;
      return;
    }

    // Game continues
    state.phase = "playing";
    state.meeting = null;
    const now = Date.now();
    for (const p of state.players) {
      if (p.role === "impostor" && p.alive) {
        p.killCooldownUntil = now;
      }
    }
  }

  private lockParty(tx: Prisma.TransactionClient, partyId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${partyId})::bigint)`;
  }

  /** Finds any active game session for the party (any gameType). */
  private findActiveAny(client: Prisma.TransactionClient, partyId: string) {
    return client.gameSession.findFirst({ where: { partyId, status: "active" } });
  }

  /** Finds an active Among Us session specifically. */
  private findActiveAmong(client: Prisma.TransactionClient, partyId: string) {
    return client.gameSession.findFirst({
      where: { partyId, status: "active", gameType: "among" },
    });
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
