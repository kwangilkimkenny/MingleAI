import { blockPairKey } from "@mingle/shared";
import { SpeedDateSweepService } from "./speed-date.sweep";
import { STAGE_ORDER_FULL, type SpeedDateConfig } from "./speed-date.config";

function cfg(over: Partial<SpeedDateConfig> = {}): SpeedDateConfig {
  return {
    stages: 1,
    stageOrder: STAGE_ORDER_FULL.slice(-1),
    groupPerGender: 3,
    preflightMs: 20000,
    stageIntroMs: 5000,
    roundMs: 180000,
    intermissionMs: 10000,
    decisionMs: 10000,
    sweepMs: 2500,
    maxWaitMs: 120000,
    baseThreshold: 0.4,
    aiFill: false,
    livekit: { url: "", apiKey: "", apiSecret: "" },
    ...over,
  };
}

const sig = (vibe: string) => ({ vibe, drinking: "light", pace: "slow", activity: [], tags: [], summary: "s" });

function entry(id: string, gender: string, vibe: string, ageSec: number, now: Date) {
  return {
    id,
    profileId: "prof-" + id,
    gender,
    status: "waiting",
    preferenceSnapshot: sig(vibe),
    enqueuedAt: new Date(now.getTime() - ageSec * 1000),
  };
}

function makePrisma(waiting: any[], activeSessions: any[] = []) {
  return {
    speedDateQueueEntry: {
      findMany: jest.fn().mockResolvedValue(waiting),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    speedDateSession: {
      findMany: jest.fn().mockResolvedValue(activeSessions),
    },
  } as any;
}

function svcWith(prisma: any, sessions: any, config: SpeedDateConfig, blocks = new Set<string>()) {
  const safety = { blocksForProfiles: jest.fn().mockResolvedValue(blocks) } as any;
  return new SpeedDateSweepService(prisma, { value: config } as any, safety, sessions);
}

const now = new Date("2026-07-22T00:00:00Z");

describe("SpeedDateSweepService.runSweep", () => {
  it("forms one session at 3 male + 3 female compatible", async () => {
    const waiting = [
      entry("m1", "male", "calm", 1, now),
      entry("m2", "male", "calm", 1, now),
      entry("m3", "male", "calm", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
      entry("f3", "female", "calm", 1, now),
    ];
    const sessions = { createSession: jest.fn().mockResolvedValue("sess-1") };
    const res = await svcWith(makePrisma(waiting), sessions, cfg()).runSweep(now);
    expect(res.formed).toBe(1);
    const [realIds, participants, males, females] = sessions.createSession.mock.calls[0];
    expect(participants).toHaveLength(6);
    expect(males).toHaveLength(3);
    expect(females).toHaveLength(3);
    expect(realIds).toHaveLength(6);
  });

  it("does not form below 3+3 without AI fill", async () => {
    const waiting = [
      entry("m1", "male", "calm", 1, now),
      entry("m2", "male", "calm", 1, now),
      entry("m3", "male", "calm", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
    ];
    const sessions = { createSession: jest.fn() };
    const res = await svcWith(makePrisma(waiting), sessions, cfg()).runSweep(now);
    expect(res.formed).toBe(0);
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("fills missing slots with AI when SPEEDDATE_AI_FILL is on", async () => {
    const waiting = [
      entry("m1", "male", "calm", 1, now),
      entry("m2", "male", "calm", 1, now),
      entry("m3", "male", "calm", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
    ];
    const sessions = { createSession: jest.fn().mockResolvedValue("sess-1") };
    const res = await svcWith(makePrisma(waiting), sessions, cfg({ aiFill: true })).runSweep(now);
    expect(res.formed).toBe(1);
    const [realIds, participants] = sessions.createSession.mock.calls[0];
    expect(participants).toHaveLength(6);
    expect(realIds).toHaveLength(5); // one AI slot has no queue entry
    expect(participants.filter((p: any) => p.isAi)).toHaveLength(1);
  });

  it("excludes a blocked cross pair (minimal 3+3 pool cannot form)", async () => {
    const waiting = [
      entry("m1", "male", "calm", 1, now),
      entry("m2", "male", "calm", 1, now),
      entry("m3", "male", "calm", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
      entry("f3", "female", "calm", 1, now),
    ];
    // m1 <-> f1 blocked; f1 is rejected → only 2 females selectable → no formation
    const blocks = new Set<string>([blockPairKey("prof-m1", "prof-f1")]);
    const sessions = { createSession: jest.fn() };
    const res = await svcWith(makePrisma(waiting), sessions, cfg(), blocks).runSweep(now);
    expect(res.formed).toBe(0);
  });

  it("gates on the wait-decayed preference threshold, then forms once decayed", async () => {
    const incompatible = [
      entry("m1", "male", "wild", 1, now),
      entry("m2", "male", "wild", 1, now),
      entry("m3", "male", "wild", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
      entry("f3", "female", "calm", 1, now),
    ];
    const fresh = { createSession: jest.fn() };
    expect((await svcWith(makePrisma(incompatible), fresh, cfg()).runSweep(now)).formed).toBe(0);

    // same low compatibility but aged near maxWait → threshold decays to ~0 → forms
    const aged = incompatible.map((e) => ({ ...e, enqueuedAt: new Date(now.getTime() - 119000) }));
    const later = { createSession: jest.fn().mockResolvedValue("sess-1") };
    expect((await svcWith(makePrisma(aged), later, cfg()).runSweep(now)).formed).toBe(1);
  });

  it("cancels a waiting entry whose owner is already in an active session (re-enqueue race)", async () => {
    const waiting = [
      entry("m1", "male", "calm", 1, now),
      entry("m2", "male", "calm", 1, now),
      entry("m3", "male", "calm", 1, now),
      entry("f1", "female", "calm", 1, now),
      entry("f2", "female", "calm", 1, now),
      entry("f3", "female", "calm", 1, now),
    ];
    const active = [{ state: { participants: [{ profileId: "prof-m1" }] } }];
    const prisma = makePrisma(waiting, active);
    const sessions = { createSession: jest.fn().mockResolvedValue("s1") } as any;
    const svc = svcWith(prisma, sessions, cfg());
    const r = await svc.runSweep(now);
    // m1 is mid-session → his entry is cancelled, leaving 2 males → no formation
    expect(r.formed).toBe(0);
    expect(prisma.speedDateQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1", status: "waiting" } }),
    );
  });

  it("never forms an all-AI session (empty queue + aiFill on)", async () => {
    const prisma = makePrisma([]);
    const sessions = { createSession: jest.fn() } as any;
    const svc = svcWith(prisma, sessions, cfg({ aiFill: true }));
    const r = await svc.runSweep(now);
    expect(r.formed).toBe(0);
    expect(sessions.createSession).not.toHaveBeenCalled();
  });

  it("times out entries older than maxWaitMs", async () => {
    const prisma = makePrisma([entry("old", "male", "calm", 200, now)]);
    const res = await svcWith(prisma, { createSession: jest.fn() }, cfg()).runSweep(now);
    expect(res.formed).toBe(0);
    expect(prisma.speedDateQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "timeout" } }),
    );
  });
});
