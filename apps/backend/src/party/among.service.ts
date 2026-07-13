import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AmongConfigProvider } from "./among.config";
import type {
  AmongRole,
  AmongTaskKind,
  AmongResultView,
  AmongSnapshot,
} from "@mingle/shared";

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
  ): Promise<AmongState> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockParty(tx, partyId);

        const any = await this.findActiveAny(tx, partyId);
        if (any) throw new ConflictException("already-active");

        const cfg = this.config.value;
        if (roster.length < cfg.minPlayers) {
          throw new BadRequestException("not-enough-players");
        }

        // Clamp impostor count: at least 1, at most floor((n-1)/2)
        const impostorCount = Math.max(
          1,
          Math.min(cfg.impostors, Math.floor((roster.length - 1) / 2)),
        );

        // Shuffle roster, first N = impostors
        const shuffled = shuffle([...roster]);

        // Fetch player names
        const rosterIds = shuffled.map((r) => r.profileId);
        const profiles = await tx.profile.findMany({
          where: { id: { in: rosterIds } },
          select: { id: true, name: true },
        });
        const nameById = new Map(profiles.map((p) => [p.id, p.name]));

        // Build players
        const players: AmongState["players"] = shuffled.map((r, idx) => ({
          profileId: r.profileId,
          name: nameById.get(r.profileId) ?? "익명",
          role: idx < impostorCount ? "impostor" : "crew",
          alive: true,
          isBot: r.isBot ?? false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        }));

        // Build tasks: each crew player gets cfg.tasksPerCrew tasks
        const tasks: AmongState["tasks"] = [];
        let taskCounter = 0;
        for (const player of players) {
          if (player.role !== "crew") continue;
          for (let i = 0; i < cfg.tasksPerCrew; i++) {
            tasks.push({
              taskId: `${player.profileId}:${i}`,
              profileId: player.profileId,
              kind: KINDS[taskCounter % 4]!,
              x: randomInRoom(),
              y: randomInRoom(),
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
      const allDone = state.tasks.every((t) => t.done);
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
      role:
        isEnded || p.profileId === viewerProfileId
          ? p.role
          : null,
    }));

    const myTasks = state.tasks
      .filter((t) => t.profileId === viewerProfileId)
      .map((t) => ({ taskId: t.taskId, kind: t.kind, x: t.x, y: t.y, done: t.done }));

    const progress = {
      done: state.tasks.filter((t) => t.done).length,
      total: state.tasks.length,
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
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

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

function randomInRoom(): number {
  return 0.1 + Math.random() * 0.8; // [0.1, 0.9)
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
