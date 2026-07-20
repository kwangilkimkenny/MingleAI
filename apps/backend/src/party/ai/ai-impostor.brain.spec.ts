import { AiImpostorBrain, AI_WITNESS_RADIUS } from "./ai-impostor.brain";
import { PARTY_MAP } from "@mingle/shared";

const CFG = {
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
  aiRequireLlm: false,
  aiLlmMaxCalls: 60,
  aiChatMinMs: 60000,
  aiChatMaxMs: 90000,
} as any;

function stateWithBots(overrides: any = {}): any {
  const now = Date.now();
  return {
    phase: "playing",
    players: [
      {
        profileId: "h1",
        name: "인간1",
        role: "crew",
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "h2",
        name: "인간2",
        role: "crew",
        alive: true,
        isBot: false,
        isAi: false,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "ai-a",
        name: "서지우",
        role: "impostor",
        alive: true,
        isBot: true,
        isAi: true,
        killCooldownUntil: null,
        emergencyUsed: 0,
      },
      {
        profileId: "ai-b",
        name: "한도윤",
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
        "ai-a": { x: 0.5, y: 0.5, targetIdx: 0, nextChatAt: now + 60000, killHoldUntil: 0 },
        "ai-b": { x: 0.8, y: 0.8, targetIdx: 1, nextChatAt: now + 60000, killHoldUntil: 0 },
      },
    },
    ...overrides,
  };
}

describe("AiImpostorBrain.tick", () => {
  it("playing: 봇이 목표 스테이션 방향으로 world 속도만큼 전진한다", () => {
    const state = stateWithBots();
    const before = { ...state.ai.bots["ai-a"] };
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now(), () => 0.99);
    const moved = step.moves.find((m) => m.profileId === "ai-a")!;
    expect(moved).toBeDefined();
    const target = PARTY_MAP.stations[before.targetIdx]!;
    const dBefore = Math.hypot((target.x - before.x) * 1.9, target.y - before.y);
    const dAfter = Math.hypot((target.x - moved.x) * 1.9, target.y - moved.y);
    expect(dAfter).toBeLessThan(dBefore);
  });

  it("쿨다운 완료 + 인간 근접 + 목격자 없음 + rand<PROB → 킬 1건", () => {
    const state = stateWithBots();
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(
      state,
      { h1: { x: bot.x + 0.01, y: bot.y } }, // killRange 내
      CFG,
      Date.now(),
      () => 0.0, // 확률 통과
    );
    expect(step.kill).toEqual(expect.objectContaining({ killerId: "ai-a", targetId: "h1" }));
  });

  it("근처에 제3의 생존 인간(목격자)이 있으면 킬하지 않는다", () => {
    const state = stateWithBots();
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(
      state,
      {
        h1: { x: bot.x + 0.01, y: bot.y },
        h2: { x: bot.x + AI_WITNESS_RADIUS / 2 / 1.9, y: bot.y }, // 목격 반경 내
      },
      CFG,
      Date.now(),
      () => 0.0,
    );
    expect(step.kill).toBeNull();
  });

  it("killHoldUntil(회의 직후 유예) 중엔 킬하지 않는다", () => {
    const now = Date.now();
    const state = stateWithBots();
    state.ai.bots["ai-a"].killHoldUntil = now + 10000;
    state.ai.bots["ai-b"].killHoldUntil = now + 10000;
    const bot = state.ai.bots["ai-a"];
    const step = AiImpostorBrain.tick(
      state,
      { h1: { x: bot.x + 0.01, y: bot.y } },
      CFG,
      now,
      () => 0.0,
    );
    expect(step.kill).toBeNull();
  });

  it("nextChatAt 도달한 봇은 idle 발화를 결정하고 다음 발화를 예약한다", () => {
    const now = Date.now();
    const state = stateWithBots();
    state.ai.bots["ai-a"].nextChatAt = now - 1;
    const step = AiImpostorBrain.tick(state, {}, CFG, now, () => 0.5);
    expect(step.chats).toEqual([{ profileId: "ai-a", scene: "idle" }]);
    expect(state.ai.bots["ai-a"].nextChatAt).toBeGreaterThan(now + CFG.aiChatMinMs - 1);
  });

  it("voting 페이즈: 미투표 생존 AI마다 votes 항목(target null)", () => {
    const state = stateWithBots({
      phase: "voting",
      meeting: {
        reason: "auto",
        calledBy: "",
        discussionEndsAt: 0,
        voteEndsAt: Date.now() + 10000,
        votes: { "ai-b": "h1" },
      },
    });
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now());
    expect(step.moves).toHaveLength(0);
    expect(step.votes).toEqual([{ profileId: "ai-a", targetId: null }]);
  });

  it("사망한 AI는 아무것도 하지 않는다", () => {
    const state = stateWithBots();
    state.players.find((p: any) => p.profileId === "ai-a").alive = false;
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now(), () => 0.0);
    expect(step.moves.every((m) => m.profileId !== "ai-a")).toBe(true);
    expect(step.chats.every((c) => c.profileId !== "ai-a")).toBe(true);
  });

  it("구세션(ai 블록 없음)은 아무것도 하지 않는다", () => {
    const state = stateWithBots();
    delete (state as any).ai;
    const step = AiImpostorBrain.tick(state, {}, CFG, Date.now(), () => 0.0);
    expect(step.moves).toHaveLength(0);
    expect(step.kill).toBeNull();
  });
});
