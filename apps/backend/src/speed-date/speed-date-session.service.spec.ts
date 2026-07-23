import { SpeedDateSessionService } from "./speed-date-session.service";
import { STAGE_ORDER_FULL, type SpeedDateConfig } from "./speed-date.config";
import { buildRotationSchedule } from "@mingle/shared";
import { type SpeedDateState } from "./speed-date.state";

function cfg(): SpeedDateConfig {
  return {
    stages: 1,
    stageOrder: STAGE_ORDER_FULL.slice(-1),
    groupPerGender: 3,
    preflightMs: 1000,
    roundMs: 3000,
    intermissionMs: 500,
    decisionMs: 1000,
    sweepMs: 2500,
    maxWaitMs: 120000,
    baseThreshold: 0.4,
    aiFill: false,
    livekit: { url: "", apiKey: "", apiSecret: "" },
  };
}

const males = ["m1", "m2", "m3"];
const females = ["f1", "f2", "f3"];

function state(over: Partial<SpeedDateState> = {}): SpeedDateState {
  return {
    phase: "round",
    stageIndex: 0,
    roundIndex: 0,
    phaseEndsAt: 1000,
    sequence: 1,
    stageOrder: ["FACE"],
    participants: [...males, ...females].map((id, i) => ({
      profileId: id,
      gender: i < 3 ? "male" : "female",
      nickname: id,
      avatarId: "av",
      isAi: false,
    })),
    males,
    females,
    schedule: buildRotationSchedule(males, females),
    choices: {},
    ...over,
  };
}

function makeSvc(prisma: any, match: any) {
  return new SpeedDateSessionService(prisma, { value: cfg() } as any, match);
}

/** choose() runs its read-modify-write inside a Serializable $transaction — mock it as pass-through. */
function txPrisma(speedDateSession: any): any {
  const p: any = { speedDateSession };
  p.$transaction = (fn: any) => fn(p);
  return p;
}

describe("SpeedDateSessionService.choose", () => {
  it("toggles a valid opposite-gender choice and persists", async () => {
    const st = state();
    const update = jest.fn().mockResolvedValue({});
    const prisma = txPrisma({ findFirst: jest.fn().mockResolvedValue({ id: "s", state: st }), update });
    const out = await makeSvc(prisma, {}).choose("s", "m1", "f2", true);
    expect(out?.choices["m1"]).toEqual(["f2"]);
    expect(update).toHaveBeenCalled();
  });

  it("rejects a same-gender target", async () => {
    const prisma = txPrisma({ findFirst: jest.fn().mockResolvedValue({ id: "s", state: state() }), update: jest.fn() });
    expect(await makeSvc(prisma, {}).choose("s", "m1", "m2", true)).toBeNull();
  });

  it("rejects a non-participant chooser", async () => {
    const prisma = txPrisma({ findFirst: jest.fn().mockResolvedValue({ id: "s", state: state() }), update: jest.fn() });
    expect(await makeSvc(prisma, {}).choose("s", "stranger", "f1", true)).toBeNull();
  });
});

describe("SpeedDateSessionService.advance", () => {
  it("decision → ended resolves mutual choices into matches", async () => {
    const st = state({ phase: "decision", stageIndex: 0, roundIndex: 2, phaseEndsAt: 0, choices: { m1: ["f1"], f1: ["m1"] } });
    const update = jest.fn().mockResolvedValue({});
    const prisma = { speedDateSession: { findFirst: jest.fn().mockResolvedValue({ id: "s", state: st }), update } } as any;
    const match = { createMatch: jest.fn().mockResolvedValue({ matchId: "match1", roomId: "room1" }) };
    const out = await makeSvc(prisma, match).advance("s", new Date(10));
    expect(out?.transitioned).toBe(true);
    expect(out?.state.phase).toBe("ended");
    expect(match.createMatch).toHaveBeenCalledWith("m1", "f1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ended" }) }),
    );
    expect(out?.state.result?.matches).toEqual([{ a: "m1", b: "f1", matchId: "match1", roomId: "room1" }]);
  });

  it("does not transition before the deadline", async () => {
    const st = state({ phase: "round", phaseEndsAt: 100000 });
    const prisma = { speedDateSession: { findFirst: jest.fn().mockResolvedValue({ id: "s", state: st }), update: jest.fn() } } as any;
    const out = await makeSvc(prisma, {}).advance("s", new Date(0));
    expect(out?.transitioned).toBe(false);
  });
});

describe("SpeedDateSessionService.resolveDecision", () => {
  it("skips AI slots and blocked pairs, creating matches only for real mutual pairs", async () => {
    const st = state({
      males: ["m1", "m2", "ai-x"],
      females: ["f1", "f2", "f3"],
      choices: {
        m1: ["f1"], f1: ["m1"], // real mutual → match
        m2: ["f2"], f2: ["m2"], // real mutual but blocked → createMatch returns null
        "ai-x": ["f3"], f3: ["ai-x"], // AI mutual → skipped without calling createMatch
      },
    });
    const match = {
      createMatch: jest.fn((a: string, b: string) =>
        a === "m2" || b === "m2" ? Promise.resolve(null) : Promise.resolve({ matchId: "match1", roomId: "room1" }),
      ),
    };
    const res = await makeSvc({}, match).resolveDecision(st);
    expect(res.matches).toEqual([{ a: "m1", b: "f1", matchId: "match1", roomId: "room1" }]);
    // AI pair never reaches createMatch
    expect(match.createMatch).not.toHaveBeenCalledWith("ai-x", "f3");
    expect(match.createMatch).not.toHaveBeenCalledWith("f3", "ai-x");
  });
});
