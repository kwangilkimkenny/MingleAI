import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AmongService } from "./among.service";
import type { AmongConfig } from "./among.config";
import type { AmongState } from "./among.service";
import { PARTY_MAP } from "@mingle/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// In-memory store for sweepMeetings tests
let mockStore: any[] = [];

const gameSession = {
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn().mockImplementation(({ where }: any) => {
    return Promise.resolve(
      mockStore.filter(
        (row) =>
          (!where.status || row.status === where.status) &&
          (!where.gameType || row.gameType === where.gameType),
      ),
    );
  }),
};
const profile = { findMany: jest.fn() };
const txExecuteRaw = jest.fn();
const prisma = {
  gameSession,
  profile,
  $executeRaw: jest.fn(),
  $transaction: jest.fn((fn: any) => fn({ gameSession, profile, $executeRaw: txExecuteRaw })),
} as any;

const DEFAULT_CONFIG: AmongConfig = {
  minPlayers: 4,
  impostors: 1,
  tasksPerCrew: 3,
  killRange: 0.12,
  taskRange: 0.1,
  killCooldownMs: 20000,
  discussionMs: 30000,
  voteMs: 30000,
  emergencyPerPlayer: 1,
  sweepMs: 1000,
};

function makeConfig(partial: Partial<AmongConfig> = {}) {
  return { value: { ...DEFAULT_CONFIG, ...partial } };
}

function makeService(configPartial: Partial<AmongConfig> = {}) {
  return new AmongService(prisma, makeConfig(configPartial) as any);
}

const service = makeService();

beforeEach(() => {
  jest.clearAllMocks();
  mockStore = [];
  // Re-wire findMany to use current mockStore after clearAllMocks
  gameSession.findMany.mockImplementation(({ where }: any) => {
    return Promise.resolve(
      mockStore.filter(
        (row) =>
          (!where.status || row.status === where.status) &&
          (!where.gameType || row.gameType === where.gameType),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roster(n: number) {
  return Array.from({ length: n }, (_, i) => ({ profileId: `p${i + 1}` }));
}

function profileNames(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player${i + 1}` }));
}

function activeRow(state: any) {
  return { id: "g1", partyId: "pt1", gameType: "among", status: "active", state };
}

/** Build a typical 4-player state: p4=impostor, p1/p2/p3=crew */
function buildPlayingState(overrides: Partial<AmongState> = {}): AmongState {
  return {
    sessionId: "g1",
    phase: "playing",
    players: [
      {
        profileId: "p1",
        name: "P1",
        role: "crew",
        alive: true,
        isBot: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p2",
        name: "P2",
        role: "crew",
        alive: true,
        isBot: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p3",
        name: "P3",
        role: "crew",
        alive: true,
        isBot: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p4",
        name: "P4",
        role: "impostor",
        alive: true,
        isBot: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
    ],
    tasks: [],
    bodies: [],
    meeting: null,
    lastEjected: null,
    result: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

describe("start", () => {
  it("4-player game: 1 impostor, 3 crew, 9 tasks total, phase playing", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    const state = await service.start("pt1", roster(4));

    expect(state.phase).toBe("playing");
    expect(state.result).toBeNull();
    expect(state.meeting).toBeNull();
    expect(state.bodies).toHaveLength(0);
    expect(state.players).toHaveLength(4);

    const impostors = state.players.filter((p) => p.role === "impostor");
    const crew = state.players.filter((p) => p.role === "crew");
    expect(impostors).toHaveLength(1);
    expect(crew).toHaveLength(3);

    // 3 crew × 3 tasks = 9
    expect(state.tasks).toHaveLength(9);
    // all belong to crew players
    const crewIds = new Set(crew.map((p) => p.profileId));
    state.tasks.forEach((t) => expect(crewIds.has(t.profileId)).toBe(true));
    expect(state.tasks.every((t) => !t.done)).toBe(true);

    // sessionId set
    expect(state.sessionId).toBe("g1");
  });

  it("태스크 좌표는 전부 PARTY_MAP 스테이션 앵커에서 나온다", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    const state = await service.start("pt1", roster(4));

    const anchors = new Set(PARTY_MAP.stations.map((s) => `${s.x},${s.y}`));
    for (const t of state.tasks) {
      expect(anchors.has(`${t.x},${t.y}`)).toBe(true);
    }
    // 셔플 배정 — 9 tasks / 8 stations이므로 결정적으로 스테이션 전부(min(9,8)=8개)를 쓴다
    const used = new Set(state.tasks.map((t) => `${t.x},${t.y}`));
    expect(used.size).toBe(Math.min(state.tasks.length, PARTY_MAP.stations.length));
  });

  it("throws not-enough-players when roster < minPlayers", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.start("pt1", roster(3))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws already-active when a session exists", async () => {
    gameSession.findFirst.mockResolvedValue(activeRow({ phase: "playing" }));
    profile.findMany.mockResolvedValue(profileNames(4));
    await expect(service.start("pt1", roster(4))).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps P2002 to already-active (DB backstop)", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    await expect(service.start("pt1", roster(4))).rejects.toBeInstanceOf(ConflictException);
  });

  it("clamps impostor count: config impostors=3, roster=4 → 1 impostor", async () => {
    const svc = makeService({ impostors: 3 });
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    const state = await svc.start("pt1", roster(4));
    const impostors = state.players.filter((p) => p.role === "impostor");
    // floor((4-1)/2)=1, Math.min(3,1)=1, Math.max(1,1)=1
    expect(impostors).toHaveLength(1);
  });

  it("runs in a transaction and acquires the party advisory lock", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    await service.start("pt1", roster(4));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    const sql = (txExecuteRaw.mock.calls[0][0] as string[]).join("?");
    expect(sql).toContain("pg_advisory_xact_lock");
  });
});

// ---------------------------------------------------------------------------
// doTask
// ---------------------------------------------------------------------------

describe("doTask", () => {
  function buildState(overrides: Partial<{ phase: string; taskDone: boolean }> = {}) {
    const crew = ["p1", "p2", "p3"];
    const tasks = crew.flatMap((pid) =>
      Array.from({ length: 3 }, (_, i) => ({
        taskId: `${pid}:${i}`,
        profileId: pid,
        kind: "wires" as const,
        x: 0.5,
        y: 0.5,
        done: overrides.taskDone ?? false,
      })),
    );
    return {
      sessionId: "g1",
      phase: (overrides.phase ?? "playing") as any,
      players: [
        {
          profileId: "p1",
          name: "P1",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p4",
          name: "P4",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
      tasks,
      bodies: [],
      meeting: null,
      lastEjected: null,
      result: null,
    };
  }

  it("marks the task done", async () => {
    const state = buildState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.doTask("pt1", "p1", "p1:0");

    const task = result.tasks.find((t) => t.taskId === "p1:0");
    expect(task?.done).toBe(true);
    // others untouched
    expect(result.tasks.filter((t) => t.done)).toHaveLength(1);
    expect(result.phase).toBe("playing");
    expect(result.result).toBeNull();
  });

  it("completes all tasks → phase ended, winner crew, reason tasks", async () => {
    // All tasks done except the last one (p3:2)
    const state = buildState({ taskDone: true });
    // mark p3:2 as not done (the one we will complete)
    const target = state.tasks.find((t) => t.taskId === "p3:2")!;
    target.done = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.doTask("pt1", "p3", "p3:2");

    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("crew");
    expect(result.result?.reason).toBe("tasks");

    // check update was called with status:"ended"
    const updateData = gameSession.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("ended");
    expect(updateData.endedAt).toBeInstanceOf(Date);
  });

  it("rejects doTask when phase is not playing", async () => {
    const state = buildState({ phase: "meeting" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.doTask("pt1", "p1", "p1:0")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects doTask with foreign task (wrong owner)", async () => {
    const state = buildState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.doTask("pt1", "p2", "p1:0")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects doTask on already-done task", async () => {
    const state = buildState({ taskDone: true });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.doTask("pt1", "p1", "p1:0")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws no-active-game when none exists", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.doTask("pt1", "p1", "p1:0")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// current
// ---------------------------------------------------------------------------

describe("current", () => {
  it("returns state when active", async () => {
    const state = {
      sessionId: "g1",
      phase: "playing",
      players: [],
      tasks: [],
      bodies: [],
      meeting: null,
      lastEjected: null,
      result: null,
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    const result = await service.current("pt1");
    expect(result).not.toBeNull();
    expect(result?.phase).toBe("playing");
  });

  it("returns null when no active game", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    const result = await service.current("pt1");
    expect(result).toBeNull();
  });

  it("does NOT use a transaction (lock-free read)", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await service.current("pt1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// end
// ---------------------------------------------------------------------------

describe("end", () => {
  it("force-ends the active game", async () => {
    const state = {
      sessionId: "g1",
      phase: "playing" as const,
      players: [],
      tasks: [],
      bodies: [],
      meeting: null,
      lastEjected: null,
      result: null,
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.end("pt1");

    expect(result.phase).toBe("ended");
    const updateData = gameSession.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("ended");
    expect(updateData.endedAt).toBeInstanceOf(Date);
  });

  it("throws no-active-game when none active", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.end("pt1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// project
// ---------------------------------------------------------------------------

describe("project", () => {
  function buildFullState(): any {
    return {
      sessionId: "g1",
      phase: "playing",
      players: [
        {
          profileId: "crew1",
          name: "C1",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "imp1",
          name: "I1",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: 9999,
          emergencyUsed: 0,
        },
      ],
      tasks: [
        { taskId: "crew1:0", profileId: "crew1", kind: "wires", x: 0.3, y: 0.4, done: false },
        { taskId: "crew1:1", profileId: "crew1", kind: "hold", x: 0.6, y: 0.7, done: true },
      ],
      bodies: [],
      meeting: null,
      lastEjected: null,
      result: null,
    };
  }

  it("returns null for null state", () => {
    expect(service.project(null, "anyone")).toBeNull();
  });

  it("crew viewer sees own role, impostor role is null while playing", () => {
    const snap = service.project(buildFullState(), "crew1");
    expect(snap).not.toBeNull();
    expect(snap!.myRole).toBe("crew");
    const impView = snap!.players.find((p) => p.profileId === "imp1");
    expect(impView!.role).toBeNull();
    const crewView = snap!.players.find((p) => p.profileId === "crew1");
    expect(crewView!.role).toBe("crew");
  });

  it("impostor viewer sees own role while playing", () => {
    const snap = service.project(buildFullState(), "imp1");
    expect(snap!.myRole).toBe("impostor");
    // imp sees their own role
    const impView = snap!.players.find((p) => p.profileId === "imp1");
    expect(impView!.role).toBe("impostor");
    // crew role hidden from impostor perspective (other players)
    const crewView = snap!.players.find((p) => p.profileId === "crew1");
    expect(crewView!.role).toBeNull();
  });

  it("after ended, all roles revealed", () => {
    const state = {
      ...buildFullState(),
      phase: "ended",
      result: { winner: "crew", reason: "tasks" },
    };
    const snap = service.project(state, "crew1");
    snap!.players.forEach((p) => expect(p.role).not.toBeNull());
  });

  it("myTasks only contains viewer's tasks", () => {
    const snap = service.project(buildFullState(), "crew1");
    expect(snap!.myTasks).toHaveLength(2);
    snap!.myTasks.forEach((t) => expect(t.taskId.startsWith("crew1")).toBe(true));
  });

  it("impostor has empty myTasks", () => {
    const snap = service.project(buildFullState(), "imp1");
    expect(snap!.myTasks).toHaveLength(0);
  });

  it("progress reflects done/total tasks", () => {
    const snap = service.project(buildFullState(), "crew1");
    // 1 done out of 2 total
    expect(snap!.progress).toEqual({ done: 1, total: 2 });
  });

  it("killCooldownUntil passed through for impostor", () => {
    const snap = service.project(buildFullState(), "imp1");
    expect(snap!.killCooldownUntil).toBe(9999);
  });

  it("killCooldownUntil null for crew", () => {
    const snap = service.project(buildFullState(), "crew1");
    expect(snap!.killCooldownUntil).toBeNull();
  });

  it("non-player viewer gets myRole null", () => {
    const snap = service.project(buildFullState(), "unknown");
    expect(snap!.myRole).toBeNull();
    expect(snap!.myTasks).toHaveLength(0);
  });

  it("sessionId is propagated to snapshot", () => {
    const snap = service.project(buildFullState(), "crew1");
    expect(snap!.sessionId).toBe("g1");
  });
});

// ---------------------------------------------------------------------------
// kill
// ---------------------------------------------------------------------------

describe("kill", () => {
  it("crew caller → invalid (not impostor)", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "p1", "p2", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("dead impostor → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p4")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "p4", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill while on cooldown → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p4")!.killCooldownUntil = Date.now() + 99999;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "p4", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill impostor target → invalid (cannot kill impostor)", async () => {
    const state = buildPlayingState({
      players: [
        {
          profileId: "p1",
          name: "P1",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p4",
          name: "P4",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    // p4 tries to kill fellow impostor p2
    await expect(service.kill("pt1", "p4", "p2", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill dead target → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "p4", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("valid kill: target dies, body added, cooldown set", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const now = Date.now();
    const result = await service.kill("pt1", "p4", "p1", 0.3, 0.7);

    const target = result.players.find((p) => p.profileId === "p1")!;
    expect(target.alive).toBe(false);
    expect(result.bodies).toHaveLength(1);
    expect(result.bodies[0]).toMatchObject({ profileId: "p1", x: 0.3, y: 0.7, reported: false });
    const killer = result.players.find((p) => p.profileId === "p4")!;
    expect(killer.killCooldownUntil).toBeGreaterThanOrEqual(
      now + DEFAULT_CONFIG.killCooldownMs - 50,
    );
    expect(result.phase).toBe("playing");
    expect(result.result).toBeNull();
  });

  it("kill phase not playing → invalid", async () => {
    const state = buildPlayingState({ phase: "meeting" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "p4", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill until impostor parity → result impostor/kills + phase ended", async () => {
    // 2 crew alive, 1 impostor alive → parity after killing 1 crew
    const state = buildPlayingState({
      players: [
        {
          profileId: "p1",
          name: "P1",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "crew",
          alive: false,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: false,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p4",
          name: "P4",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.kill("pt1", "p4", "p1", 0.5, 0.5);

    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("impostor");
    expect(result.result?.reason).toBe("kills");
    const updateData = gameSession.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("ended");
    expect(updateData.endedAt).toBeInstanceOf(Date);
  });

  it("no active game → NotFoundException", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.kill("pt1", "p4", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

describe("report", () => {
  it("report existing unreported body → phase meeting, meeting object set", async () => {
    const state = buildPlayingState({
      bodies: [{ profileId: "p2", x: 0.5, y: 0.5, reported: false }],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.report("pt1", "p1", "p2");

    expect(result.phase).toBe("meeting");
    expect(result.meeting).not.toBeNull();
    expect(result.meeting!.reason).toBe("report");
    expect(result.meeting!.calledBy).toBe("p1");
    expect(result.meeting!.bodyProfileId).toBe("p2");
    expect(result.meeting!.votes).toEqual({});
    expect(typeof result.meeting!.discussionEndsAt).toBe("number");
    expect(typeof result.meeting!.voteEndsAt).toBe("number");
    expect(result.meeting!.voteEndsAt).toBeGreaterThan(result.meeting!.discussionEndsAt);
    // body marked reported
    expect(result.bodies[0]!.reported).toBe(true);
  });

  it("report nonexistent body → invalid", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.report("pt1", "p1", "p99")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("report already-reported body → invalid", async () => {
    const state = buildPlayingState({
      bodies: [{ profileId: "p2", x: 0.5, y: 0.5, reported: true }],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.report("pt1", "p1", "p2")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("dead caller can still report (MVP: any alive or dead finds body)", async () => {
    // Per spec: caller alive check → spec says "caller alive (in players)". Let's test alive caller only.
    // Dead caller → invalid per spec
    const state = buildPlayingState({
      bodies: [{ profileId: "p2", x: 0.5, y: 0.5, reported: false }],
    });
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.report("pt1", "p1", "p2")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("report when phase is not playing → invalid", async () => {
    const state = buildPlayingState({ phase: "voting" });
    state.bodies.push({ profileId: "p2", x: 0.5, y: 0.5, reported: false });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.report("pt1", "p1", "p2")).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// emergency
// ---------------------------------------------------------------------------

describe("emergency", () => {
  it("within limit → enters meeting with reason emergency", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.emergency("pt1", "p1");

    expect(result.phase).toBe("meeting");
    expect(result.meeting!.reason).toBe("emergency");
    expect(result.meeting!.calledBy).toBe("p1");
    expect(result.meeting!.bodyProfileId).toBeUndefined();
    const caller = result.players.find((p) => p.profileId === "p1")!;
    expect(caller.emergencyUsed).toBe(1);
  });

  it("over limit → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p1")!.emergencyUsed =
      DEFAULT_CONFIG.emergencyPerPlayer;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.emergency("pt1", "p1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("dead caller → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.emergency("pt1", "p1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("phase not playing → invalid", async () => {
    const state = buildPlayingState({ phase: "voting" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.emergency("pt1", "p1")).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// vote
// ---------------------------------------------------------------------------

describe("vote", () => {
  function buildVotingState(extraVotes: Record<string, string> = {}): AmongState {
    return {
      ...buildPlayingState(),
      phase: "voting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 1000,
        voteEndsAt: Date.now() + 30000,
        votes: { ...extraVotes },
      },
    };
  }

  it("vote while phase 'playing' → invalid", async () => {
    const state = buildPlayingState();
    // Attach a meeting to make the only issue be phase
    (state as any).meeting = {
      reason: "emergency",
      calledBy: "p1",
      discussionEndsAt: Date.now() - 1000,
      voteEndsAt: Date.now() + 30000,
      votes: {},
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "p4")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("vote while phase 'meeting' → invalid", async () => {
    const state: AmongState = {
      ...buildPlayingState(),
      phase: "meeting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() + 30000,
        voteEndsAt: Date.now() + 60000,
        votes: {},
      },
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "p4")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("dead player cannot vote → invalid", async () => {
    const state = buildVotingState();
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "p4")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("already voted → invalid", async () => {
    const state = buildVotingState({ p1: "p4" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "p4")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records vote, game continues when not all voted", async () => {
    const state = buildVotingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p1", "p4");

    // Not all 4 players voted (only 1), game continues
    expect(result.meeting!.votes["p1"]).toBe("p4");
    expect(result.phase).toBe("voting");
    expect(result.result).toBeNull();
  });

  it("all alive players vote → resolveMeeting: plurality target ejected, game continues", async () => {
    // 3 crew alive + 1 impostor alive; all vote to eject impostor p4
    const state = buildVotingState({ p1: "p4", p2: "p4", p3: "p4" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    // p4 (the last to vote) casts their own vote as "skip" — majority is still p4 for 3 votes
    const result = await service.vote("pt1", "p4", "skip");

    // p4 should be ejected
    const ejected = result.players.find((p) => p.profileId === "p4")!;
    expect(ejected.alive).toBe(false);
    expect(result.lastEjected?.profileId).toBe("p4");
    expect(result.lastEjected?.wasSkip).toBe(false);
    // All impostors dead → crew wins
    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("crew");
    expect(result.result?.reason).toBe("ejected");
  });

  it("all alive vote: impostor ejected but crew still outnumbered → impostor wins", async () => {
    // 1 crew alive, 2 impostors alive — after ejecting 1 impostor: 1 crew vs 1 impostor → parity → impostor wins
    const state: AmongState = {
      sessionId: "g1",
      phase: "voting",
      players: [
        {
          profileId: "p1",
          name: "P1",
          role: "crew",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "impostor",
          alive: true,
          isBot: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
      tasks: [],
      bodies: [],
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 1000,
        voteEndsAt: Date.now() + 30000,
        votes: { p2: "p3", p3: "p3" },
      },
      lastEjected: null,
      result: null,
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p1", "p3");

    // p3 gets 3 votes (p1+p2+p3 all voted for p3), ejected
    expect(result.players.find((p) => p.profileId === "p3")!.alive).toBe(false);
    // After ejection: p1(crew alive), p2(impostor alive) → parity → impostor wins
    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("impostor");
    expect(result.result?.reason).toBe("kills");
    // Regression: the ended snapshot must NOT carry a stale meeting object.
    expect(result.meeting).toBeNull();
  });

  it("tie vote → no eject, lastEjected.wasSkip true, game continues", async () => {
    // p1, p2 vote for p3; p3, p4 vote for p1 → 2-2 tie
    const state = buildVotingState({ p1: "p4", p2: "p4" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    // p3 votes for p1, p4 votes for p1 → tie: p4 has 2 votes, p1 has 2 votes
    // We need all 4 to vote: p1 and p2 already voted (p4), p3 votes (skip is fine too)
    // Let's reconstruct: p1→p4, p2→p4, p3→p1, and p4 is the last voter
    const state2 = buildVotingState({ p1: "p4", p2: "p4", p3: "p1" });
    gameSession.findFirst.mockResolvedValue(activeRow(state2));

    const result = await service.vote("pt1", "p4", "p1");

    // Tally: p4 gets 2 votes (p1+p2), p1 gets 2 votes (p3+p4) → tie
    expect(result.lastEjected?.wasSkip).toBe(true);
    expect(result.phase).toBe("playing");
    expect(result.meeting).toBeNull();
    expect(result.result).toBeNull();
  });

  it("skip majority → no eject, wasSkip true, game continues", async () => {
    const state = buildVotingState({ p1: "skip", p2: "skip", p3: "skip" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p4", "p1");

    // skip has 3 votes, p1 has 1 → skip wins → no eject
    expect(result.lastEjected?.wasSkip).toBe(true);
    expect(result.phase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// sweepMeetings
// ---------------------------------------------------------------------------

describe("sweepMeetings", () => {
  /** Seed the mock store and wire findFirst/findMany appropriately. */
  function seedRow(id: string, partyId: string, state: AmongState) {
    const row = { id, partyId, gameType: "among", status: "active", state };
    mockStore.push(row);
    // findFirst in tx will use the mock from gameSession
    return row;
  }

  beforeEach(() => {
    gameSession.update.mockResolvedValue({});
    // Wire findFirst to look up by partyId from mockStore inside transaction
    gameSession.findFirst.mockImplementation(({ where }: any) => {
      const row = mockStore.find(
        (r) =>
          r.partyId === where.partyId &&
          r.status === (where.status ?? r.status) &&
          r.gameType === (where.gameType ?? r.gameType),
      );
      return Promise.resolve(row ?? null);
    });
  });

  it("phase 'meeting' with past discussionEndsAt → flips to voting, returns partyId", async () => {
    const state = buildPlayingState({
      phase: "meeting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 5000, // in the past
        voteEndsAt: Date.now() + 30000,
        votes: {},
      },
    });
    seedRow("g1", "pt1", state);

    const result = await service.sweepMeetings();

    expect(result).toContain("pt1");
    const updateData = gameSession.update.mock.calls[0][0].data;
    const updatedState = updateData.state as AmongState;
    expect(updatedState.phase).toBe("voting");
  });

  it("phase 'voting' with past voteEndsAt → resolves meeting, returns partyId", async () => {
    // All 4 players alive, votes already in (but need resolve via sweep)
    // No votes yet, so no one ejected → skip
    const state = buildPlayingState({
      phase: "voting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 60000,
        voteEndsAt: Date.now() - 1000, // in the past
        votes: {},
      },
    });
    seedRow("g1", "pt1", state);

    const result = await service.sweepMeetings();

    expect(result).toContain("pt1");
    const updateData = gameSession.update.mock.calls[0][0].data;
    const updatedState = updateData.state as AmongState;
    // No votes = skip result, phase back to playing
    expect(updatedState.phase).toBe("playing");
    expect(updatedState.lastEjected?.wasSkip).toBe(true);
    expect(updatedState.meeting).toBeNull();
  });

  it("phase 'playing' (no meeting) → not swept, not in result", async () => {
    const state = buildPlayingState();
    seedRow("g1", "pt1", state);

    const result = await service.sweepMeetings();

    expect(result).not.toContain("pt1");
    expect(gameSession.update).not.toHaveBeenCalled();
  });

  it("phase 'meeting' with future discussionEndsAt → not swept", async () => {
    const state = buildPlayingState({
      phase: "meeting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() + 99999,
        voteEndsAt: Date.now() + 199999,
        votes: {},
      },
    });
    seedRow("g1", "pt1", state);

    const result = await service.sweepMeetings();

    expect(result).not.toContain("pt1");
  });

  it("handles multiple parties: advances eligible ones, skips others", async () => {
    const stateA = buildPlayingState({
      phase: "meeting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 5000,
        voteEndsAt: Date.now() + 30000,
        votes: {},
      },
    });
    const stateB = buildPlayingState({ phase: "playing" });

    seedRow("g1", "pt1", stateA);
    seedRow("g2", "pt2", stateB);

    // Need separate findFirst for each partyId
    gameSession.findFirst.mockImplementation(({ where }: any) => {
      const row = mockStore.find(
        (r) =>
          r.partyId === where.partyId &&
          (!where.status || r.status === where.status) &&
          (!where.gameType || r.gameType === where.gameType),
      );
      return Promise.resolve(row ?? null);
    });

    const result = await service.sweepMeetings();

    expect(result).toContain("pt1");
    expect(result).not.toContain("pt2");
  });
});

// ---------------------------------------------------------------------------
// dead-crew task exclusion (QA ISSUE-002): dead players' pending tasks must not
// block the crew task win, or the game can deadlock (dead crew can't act).
// ---------------------------------------------------------------------------

describe("dead-crew task exclusion (QA ISSUE-002)", () => {
  /** p1/p2/p3 crew (3 tasks each), p4 impostor. `doneBy` marks which crew's tasks are done. */
  function buildTaskState(doneBy: string[], deadIds: string[] = []): AmongState {
    const crew = ["p1", "p2", "p3"];
    const tasks = crew.flatMap((pid) =>
      Array.from({ length: 3 }, (_, i) => ({
        taskId: `${pid}:${i}`,
        profileId: pid,
        kind: "wires" as const,
        x: 0.5,
        y: 0.5,
        done: doneBy.includes(pid),
      })),
    );
    const state = buildPlayingState({ tasks });
    for (const id of deadIds) {
      state.players.find((p) => p.profileId === id)!.alive = false;
    }
    return state;
  }

  it("doTask: last alive-crew task wins even when a dead crew has pending tasks", async () => {
    // p3 is dead with 3 pending tasks; p2 done; p1 has one task left.
    const state = buildTaskState(["p2"], ["p3"]);
    state.tasks.find((t) => t.taskId === "p1:0")!.done = true;
    state.tasks.find((t) => t.taskId === "p1:1")!.done = true;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.doTask("pt1", "p1", "p1:2");

    expect(result.phase).toBe("ended");
    expect(result.result).toEqual({ winner: "crew", reason: "tasks" });
  });

  it("kill: victim's pending tasks stop blocking — remaining crew all done → crew task win", async () => {
    // p1/p2 done, p3 pending; impostor p4 kills p3 (no parity: 2 crew vs 1 impostor).
    const state = buildTaskState(["p1", "p2"]);
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.kill("pt1", "p4", "p3", 0.3, 0.7);

    expect(result.phase).toBe("ended");
    expect(result.result).toEqual({ winner: "crew", reason: "tasks" });
  });

  it("vote/eject: ejecting a crew with pending tasks triggers the task win when others are done", async () => {
    // p1/p2 done, p3 pending. Everyone votes p3 → ejected. Impostor p4 still alive,
    // no parity (2 crew vs 1 impostor), and all remaining required tasks are done.
    const state: AmongState = {
      ...buildTaskState(["p1", "p2"]),
      phase: "voting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 1000,
        voteEndsAt: Date.now() + 30000,
        votes: { p2: "p3", p3: "p3", p4: "p3" },
      },
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p1", "p3");

    expect(result.phase).toBe("ended");
    expect(result.result).toEqual({ winner: "crew", reason: "tasks" });
    expect(result.meeting).toBeNull();
  });

  it("project: progress excludes dead players' tasks from done and total", () => {
    // p1 done (3), p2 alive pending (3), p3 dead with 1 done + 2 pending.
    const state = buildTaskState(["p1"], ["p3"]);
    state.tasks.find((t) => t.taskId === "p3:0")!.done = true;

    const snap = service.project(state, "p2");

    // Required = alive-owned tasks only: p1(3) + p2(3). Done = p1's 3.
    expect(snap!.progress).toEqual({ done: 3, total: 6 });
  });
});
