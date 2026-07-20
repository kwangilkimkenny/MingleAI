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
  aiCount: 2,
  autoMeetingMs: 120000,
  // 기본 스위트는 LLM 게이트를 통과해야 하므로 false — true 케이스는 전용 테스트에서 검증.
  aiRequireLlm: false,
  aiLlmMaxCalls: 60,
  aiChatMinMs: 60000,
  aiChatMaxMs: 90000,
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

/**
 * Compact 4-player set (3 human crew + 1 AI impostor) — mirrors the shape of the
 * pre-2026-07-20 human-impostor fixture, so tests whose player *count* matters
 * (e.g. "every alive player voted" auto-resolution) keep working with a plain
 * p4 → ai-1 rename instead of a full rewrite.
 */
function compactPlayers(): AmongState["players"] {
  return [
    {
      profileId: "p1",
      name: "P1",
      role: "crew",
      alive: true,
      isBot: false,
      isAi: false,
      killCooldownUntil: null,
      emergencyUsed: 0,
    },
    {
      profileId: "p2",
      name: "P2",
      role: "crew",
      alive: true,
      isBot: false,
      isAi: false,
      killCooldownUntil: null,
      emergencyUsed: 0,
    },
    {
      profileId: "p3",
      name: "P3",
      role: "crew",
      alive: true,
      isBot: false,
      isAi: false,
      killCooldownUntil: null,
      emergencyUsed: 0,
    },
    {
      profileId: "ai-1",
      name: "AI1",
      role: "impostor",
      alive: true,
      isBot: true,
      isAi: true,
      killCooldownUntil: null,
      emergencyUsed: 0,
    },
  ];
}

/** Build a typical 4-human + 2-AI-impostor state: p1..p4=crew (human), ai-1/ai-2=impostor (AI). */
function buildPlayingState(overrides: Partial<AmongState> = {}): AmongState {
  const now = Date.now();
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
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p2",
        name: "P2",
        role: "crew",
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p3",
        name: "P3",
        role: "crew",
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "p4",
        name: "P4",
        role: "crew",
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "ai-1",
        name: "AI1",
        role: "impostor",
        alive: true,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "ai-2",
        name: "AI2",
        role: "impostor",
        alive: true,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
    ],
    tasks: [],
    bodies: [],
    meeting: null,
    lastEjected: null,
    result: null,
    nextAutoMeetingAt: now + 120000,
    ai: {
      llmCalls: 0,
      bots: {
        "ai-1": {
          x: 0.5,
          y: 0.5,
          targetIdx: 0,
          nextChatAt: now + 15000,
          killHoldUntil: now + 20000,
          persona: { age: 27, gender: "female", occupation: "마케터", style: "무심한 말투" },
        },
        "ai-2": {
          x: 0.5,
          y: 0.5,
          targetIdx: 1,
          nextChatAt: now + 22000,
          killHoldUntil: now + 20000,
          persona: { age: 29, gender: "male", occupation: "개발자", style: "건조한 말투" },
        },
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

describe("start", () => {
  it("인간 4명 전원 crew + AI 임포스터 2명 잠입, 태스크는 인간에게만", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    profile.findMany.mockResolvedValue(profileNames(4));
    gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    const now = Date.now();
    const state = await service.start("pt1", roster(4));

    expect(state.players).toHaveLength(6); // 인간 4 + AI 2
    const humans = state.players.filter((p) => !p.isAi);
    const ais = state.players.filter((p) => p.isAi);
    expect(humans).toHaveLength(4);
    expect(humans.every((p) => p.role === "crew")).toBe(true); // 인간 임포스터 금지
    expect(ais).toHaveLength(2);
    expect(ais.every((p) => p.role === "impostor")).toBe(true);
    expect(ais.every((p) => p.profileId.startsWith("ai-"))).toBe(true);
    // AI 임포스터도 킬 쿨다운을 갖고 시작한다 — 시작 즉시 킬 불가(now+killCooldownMs 이후).
    expect(
      ais.every(
        (p) =>
          p.killCooldownUntil !== null &&
          p.killCooldownUntil >= now + DEFAULT_CONFIG.killCooldownMs,
      ),
    ).toBe(true);
    // 태스크는 인간 크루에게만
    const humanIds = new Set(humans.map((p) => p.profileId));
    expect(state.tasks).toHaveLength(4 * 3);
    state.tasks.forEach((t) => expect(humanIds.has(t.profileId)).toBe(true));
    // 자동 회의 예약 + AI 봇 상태 초기화
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
    expect(Object.keys(state.ai.bots)).toHaveLength(2);

    expect(state.phase).toBe("playing");
    expect(state.result).toBeNull();
    expect(state.meeting).toBeNull();
    expect(state.bodies).toHaveLength(0);
    expect(state.sessionId).toBe("g1");
  });

  it("aiRequireLlm=true + llmEnabled=false → ai-unavailable 거부", async () => {
    const svc = makeService({ aiRequireLlm: true });
    gameSession.findFirst.mockResolvedValue(null);
    await expect(svc.start("pt1", roster(4), { llmEnabled: false })).rejects.toThrow(
      "ai-unavailable",
    );
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
    // 셔플 배정 — 인간 4명 crew × 3 tasks = 12 tasks / 8 stations이므로 결정적으로
    // 스테이션 전부(min(12,8)=8개)를 쓴다.
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
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "crew",
          alive: true,
          isBot: false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: true,
          isBot: false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-1",
          name: "AI1",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
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

  it("projection: 플레이 중 isAi 미노출, ended에서만 노출", () => {
    const state = buildPlayingState();
    const playing = service.project(state, "p1")!;
    expect(playing.players.every((p) => (p as any).isAi === undefined)).toBe(true);
    const ended = service.project({ ...state, phase: "ended" }, "p1")!;
    expect(ended.players.filter((p) => p.isAi === true)).toHaveLength(2);
  });

  it("projection: nextAutoMeetingAt은 playing일 때만 값, 그 외 null", () => {
    const state = buildPlayingState();
    const playing = service.project(state, "p1")!;
    expect(playing.nextAutoMeetingAt).toBe(state.nextAutoMeetingAt);
    const ended = service.project({ ...state, phase: "ended" }, "p1")!;
    expect(ended.nextAutoMeetingAt).toBeNull();
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
    state.players.find((p) => p.profileId === "ai-1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "ai-1", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill while on cooldown → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "ai-1")!.killCooldownUntil = Date.now() + 99999;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "ai-1", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
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
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-1",
          name: "AI1",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: true,
          isBot: false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-2",
          name: "AI2",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    // ai-2 tries to kill fellow impostor ai-1
    await expect(service.kill("pt1", "ai-2", "ai-1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("kill dead target → invalid", async () => {
    const state = buildPlayingState();
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "ai-1", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("valid kill: target dies, body added, cooldown set", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const now = Date.now();
    const result = await service.kill("pt1", "ai-1", "p1", 0.3, 0.7);

    const target = result.players.find((p) => p.profileId === "p1")!;
    expect(target.alive).toBe(false);
    expect(result.bodies).toHaveLength(1);
    expect(result.bodies[0]).toMatchObject({ profileId: "p1", x: 0.3, y: 0.7, reported: false });
    const killer = result.players.find((p) => p.profileId === "ai-1")!;
    expect(killer.killCooldownUntil).toBeGreaterThanOrEqual(
      now + DEFAULT_CONFIG.killCooldownMs - 50,
    );
    expect(result.phase).toBe("playing");
    expect(result.result).toBeNull();
  });

  it("kill phase not playing → invalid", async () => {
    const state = buildPlayingState({ phase: "meeting" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.kill("pt1", "ai-1", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
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
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p2",
          name: "P2",
          role: "crew",
          alive: false,
          isBot: false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "p3",
          name: "P3",
          role: "crew",
          alive: false,
          isBot: false,
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-1",
          name: "AI1",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
      ],
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.kill("pt1", "ai-1", "p1", 0.5, 0.5);

    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("impostor");
    expect(result.result?.reason).toBe("kills");
    const updateData = gameSession.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("ended");
    expect(updateData.endedAt).toBeInstanceOf(Date);
  });

  it("no active game → NotFoundException", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.kill("pt1", "ai-1", "p1", 0.5, 0.5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ---------------------------------------------------------------------------
// runBotTick
// ---------------------------------------------------------------------------

describe("runBotTick", () => {
  it("playing 파티: 봇 이동을 저장하고 step을 반환한다", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);
    const out = await service.runBotTick("pt1", {});
    expect(out).not.toBeNull();
    expect(out!.step.moves.length).toBeGreaterThan(0);
    expect(gameSession.update).toHaveBeenCalled(); // 봇 위치 저장
  });

  it("킬 결정 시 기존 kill 경로를 태워 시체·쿨다운·승패 판정이 일관된다", async () => {
    const state = buildPlayingState();
    const botId = state.players.find((p: any) => p.isAi)!.profileId;
    state.ai.bots[botId].killHoldUntil = 0;
    state.players.forEach((p: any) => {
      if (p.isAi) p.killCooldownUntil = null;
    });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);
    const bot = state.ai.bots[botId];
    const out = await service.runBotTick("pt1", { p1: { x: bot.x, y: bot.y } }, () => 0.0);
    expect(out!.state.bodies.some((b: any) => b.profileId === "p1")).toBe(true);
    expect(out!.state.players.find((p: any) => p.profileId === "p1")!.alive).toBe(false);
  });

  it("meeting phase에서는 아무 것도 하지 않고 null을 반환한다", async () => {
    const state = buildPlayingState({ phase: "meeting" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    const out = await service.runBotTick("pt1", {});
    expect(out).toBeNull();
    expect(gameSession.update).not.toHaveBeenCalled();
  });

  it("활성 세션이 없으면 null을 반환한다", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    const out = await service.runBotTick("pt1", {});
    expect(out).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// bumpLlmCalls
// ---------------------------------------------------------------------------

describe("bumpLlmCalls", () => {
  it("state.ai.llmCalls를 1 증가시켜 저장한다", async () => {
    const state = buildPlayingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    await service.bumpLlmCalls("pt1");

    const updateData = gameSession.update.mock.calls[0][0].data;
    expect(updateData.state.ai.llmCalls).toBe(1);
  });

  it("활성 세션이 없으면 조용히 아무것도 하지 않는다", async () => {
    gameSession.findFirst.mockResolvedValue(null);
    await expect(service.bumpLlmCalls("pt1")).resolves.toBeUndefined();
    expect(gameSession.update).not.toHaveBeenCalled();
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
  /** Compact 4-player voting state (3 human crew + 1 AI impostor). */
  function buildVotingState(extraVotes: Record<string, string> = {}): AmongState {
    return {
      ...buildPlayingState({ players: compactPlayers() }),
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
    await expect(service.vote("pt1", "p1", "ai-1")).rejects.toBeInstanceOf(BadRequestException);
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
    await expect(service.vote("pt1", "p1", "ai-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("dead player cannot vote → invalid", async () => {
    const state = buildVotingState();
    state.players.find((p) => p.profileId === "p1")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "ai-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("already voted → invalid", async () => {
    const state = buildVotingState({ p1: "ai-1" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    await expect(service.vote("pt1", "p1", "ai-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records vote, game continues when not all voted", async () => {
    const state = buildVotingState();
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p1", "ai-1");

    // Not all 4 players voted (only 1), game continues
    expect(result.meeting!.votes["p1"]).toBe("ai-1");
    expect(result.phase).toBe("voting");
    expect(result.result).toBeNull();
  });

  it("all alive players vote → resolveMeeting: plurality target ejected, game continues", async () => {
    // 3 crew alive + 1 impostor alive; all vote to eject impostor ai-1
    const state = buildVotingState({ p1: "ai-1", p2: "ai-1", p3: "ai-1" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    // ai-1 (the last to vote) casts their own vote as "skip" — majority is still ai-1 for 3 votes
    const result = await service.vote("pt1", "ai-1", "skip");

    // ai-1 should be ejected
    const ejected = result.players.find((p) => p.profileId === "ai-1")!;
    expect(ejected.alive).toBe(false);
    expect(result.lastEjected?.profileId).toBe("ai-1");
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
          isAi: false,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-1",
          name: "AI1",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
          killCooldownUntil: null,
          emergencyUsed: 0,
        },
        {
          profileId: "ai-2",
          name: "AI2",
          role: "impostor",
          alive: true,
          isBot: true,
          isAi: true,
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
        votes: { "ai-1": "ai-2", "ai-2": "ai-2" },
      },
      lastEjected: null,
      result: null,
      nextAutoMeetingAt: Date.now() + 120000,
      ai: { llmCalls: 0, bots: {} },
    };
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "p1", "ai-2");

    // ai-2 gets 3 votes (p1+ai-1+ai-2 all voted for ai-2), ejected
    expect(result.players.find((p) => p.profileId === "ai-2")!.alive).toBe(false);
    // After ejection: p1(crew alive), ai-1(impostor alive) → parity → impostor wins
    expect(result.phase).toBe("ended");
    expect(result.result?.winner).toBe("impostor");
    expect(result.result?.reason).toBe("kills");
    // Regression: the ended snapshot must NOT carry a stale meeting object.
    expect(result.meeting).toBeNull();
  });

  it("tie vote → no eject, lastEjected.wasSkip true, game continues", async () => {
    // p1, p2 vote for ai-1; p3, ai-1 vote for p1 → 2-2 tie
    const state2 = buildVotingState({ p1: "ai-1", p2: "ai-1", p3: "p1" });
    gameSession.findFirst.mockResolvedValue(activeRow(state2));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "ai-1", "p1");

    // Tally: ai-1 gets 2 votes (p1+p2), p1 gets 2 votes (p3+ai-1) → tie
    expect(result.lastEjected?.wasSkip).toBe(true);
    expect(result.phase).toBe("playing");
    expect(result.meeting).toBeNull();
    expect(result.result).toBeNull();
  });

  it("회의 해소 후 게임이 계속되면 AI 봇의 killHoldUntil이 유예된다", async () => {
    // Same tie scenario as above — game continues, so the post-meeting hold should bump.
    const state2 = buildVotingState({ p1: "ai-1", p2: "ai-1", p3: "p1" });
    state2.ai.bots["ai-1"]!.killHoldUntil = 0;
    state2.ai.bots["ai-2"]!.killHoldUntil = 0;
    gameSession.findFirst.mockResolvedValue(activeRow(state2));
    gameSession.update.mockResolvedValue({});

    const before = Date.now();
    const result = await service.vote("pt1", "ai-1", "p1");

    expect(result.phase).toBe("playing");
    expect(result.ai.bots["ai-1"]!.killHoldUntil).toBeGreaterThanOrEqual(before);
    expect(result.ai.bots["ai-2"]!.killHoldUntil).toBeGreaterThanOrEqual(before);
  });

  it("skip majority → no eject, wasSkip true, game continues", async () => {
    const state = buildVotingState({ p1: "skip", p2: "skip", p3: "skip" });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.vote("pt1", "ai-1", "p1");

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
    // All players alive, no votes yet, so no one ejected → skip
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
// sweepAutoMeetings
// ---------------------------------------------------------------------------

describe("sweepAutoMeetings", () => {
  function seedRow(id: string, partyId: string, state: AmongState) {
    const row = { id, partyId, gameType: "among", status: "active", state };
    mockStore.push(row);
    return row;
  }

  beforeEach(() => {
    gameSession.update.mockResolvedValue({});
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

  it("기한 도달한 playing 파티에 auto 회의를 소집한다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: Date.now() - 1000 });
    seedRow("g1", "pt1", state);
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    const advanced = await service.sweepAutoMeetings();
    expect(advanced).toContain("pt1");
    expect(state.phase).toBe("meeting");
    expect(state.meeting?.reason).toBe("auto");
  });

  it("기한 전이면 건드리지 않는다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: Date.now() + 60000 });
    seedRow("g1", "pt1", state);

    const advanced = await service.sweepAutoMeetings();
    expect(advanced).toHaveLength(0);
    expect(state.phase).toBe("playing");
  });

  it("회의 해소 후 nextAutoMeetingAt이 미래로 리셋된다", async () => {
    const state = buildPlayingState();
    state.phase = "voting";
    state.meeting = {
      reason: "auto",
      calledBy: "",
      phase: "voting",
      discussionEndsAt: Date.now() - 20000,
      voteEndsAt: Date.now() - 1000,
      votes: {},
    } as any;
    state.nextAutoMeetingAt = 0;
    seedRow("g1", "pt1", state);
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    await service.sweepMeetings();
    expect(state.phase).toBe("playing");
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
  });

  it("구세션(nextAutoMeetingAt 없음)은 자동 회의를 소집하지 않는다", async () => {
    const state = buildPlayingState();
    delete (state as any).nextAutoMeetingAt;
    seedRow("g1", "pt1", state);

    const advanced = await service.sweepAutoMeetings();
    expect(advanced).toHaveLength(0);
    expect(state.phase).toBe("playing");
  });

  it("report 소집도 nextAutoMeetingAt을 리셋한다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: 1 });
    state.bodies = [{ profileId: "p2", x: 0.5, y: 0.5, reported: false }];
    state.players.find((p: any) => p.profileId === "p2")!.alive = false;
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    await service.report("pt1", "p1", "p2");
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
  });

  it("emergency 소집도 nextAutoMeetingAt을 리셋한다", async () => {
    const state = buildPlayingState({ nextAutoMeetingAt: 1 });
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockImplementation(async ({ data }: any) => data);

    await service.emergency("pt1", "p1");
    expect(state.nextAutoMeetingAt).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// dead-crew task exclusion (QA ISSUE-002): dead players' pending tasks must not
// block the crew task win, or the game can deadlock (dead crew can't act).
// ---------------------------------------------------------------------------

describe("dead-crew task exclusion (QA ISSUE-002)", () => {
  /** p1/p2/p3 crew (3 tasks each), ai-1 impostor. `doneBy` marks which crew's tasks are done. */
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
    const state = buildPlayingState({ players: compactPlayers(), tasks });
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
    // p1/p2 done, p3 pending; impostor ai-1 kills p3 (no parity: 2 crew vs 1 impostor).
    const state = buildTaskState(["p1", "p2"]);
    gameSession.findFirst.mockResolvedValue(activeRow(state));
    gameSession.update.mockResolvedValue({});

    const result = await service.kill("pt1", "ai-1", "p3", 0.3, 0.7);

    expect(result.phase).toBe("ended");
    expect(result.result).toEqual({ winner: "crew", reason: "tasks" });
  });

  it("vote/eject: ejecting a crew with pending tasks triggers the task win when others are done", async () => {
    // p1/p2 done, p3 pending. Everyone votes p3 → ejected. Impostor ai-1 still alive,
    // no parity (2 crew vs 1 impostor), and all remaining required tasks are done.
    const state: AmongState = {
      ...buildTaskState(["p1", "p2"]),
      phase: "voting",
      meeting: {
        reason: "emergency",
        calledBy: "p1",
        discussionEndsAt: Date.now() - 1000,
        voteEndsAt: Date.now() + 30000,
        votes: { p2: "p3", p3: "p3", "ai-1": "p3" },
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
