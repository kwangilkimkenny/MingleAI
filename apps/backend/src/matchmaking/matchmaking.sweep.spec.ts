import { MatchmakingSweepService } from "./matchmaking.sweep";
import type { MatchmakingConfig } from "./matchmaking.config";

const cfg: MatchmakingConfig = { min: 4, max: 8, sweepMs: 2500, maxWaitMs: 120000, baseThreshold: 0.5 };
const sig = (v: string) => ({ vibe: v, drinking: "light", pace: "slow", activity: [], tags: [], summary: "s" });

function entry(id: string, vibe: string, ageSec: number, now: Date) {
  return { id, profileId: "prof-" + id, status: "waiting", matchedPartyId: null,
    preferenceSnapshot: sig(vibe), enqueuedAt: new Date(now.getTime() - ageSec * 1000) };
}

function makePrisma(waiting: any[]) {
  const claimed = new Set<string>();
  return {
    _party: null as any,
    matchmakingQueueEntry: {
      findMany: jest.fn().mockResolvedValue(waiting),
      updateMany: jest.fn(async ({ where }: any) => {
        // status-guarded: only claims entries not already claimed
        if (where.id && where.status === "waiting") {
          if (claimed.has(where.id)) return { count: 0 };
          claimed.add(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    party: { create: jest.fn(async ({ data }: any) => ({ id: "party-1", ...data })) },
    partyParticipant: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(async (fn: any) => fn(prismaTx)),
  } as any;
}
let prismaTx: any;

describe("MatchmakingSweepService.runSweep", () => {
  it("forms one party when >= min compatible entries are waiting", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const waiting = ["a", "b", "c", "d"].map((id) => entry(id, "calm", 1, now));
    const prisma = makePrisma(waiting);
    prismaTx = prisma; // same guarded updateMany + create used inside the tx
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(1);
    expect(prisma.party.create).toHaveBeenCalledTimes(1);
    expect(prisma.partyParticipant.createMany).toHaveBeenCalledTimes(1);
  });

  it("does not form a party below min", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const prisma = makePrisma(["a", "b", "c"].map((id) => entry(id, "calm", 1, now)));
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(0);
  });

  it("cancels entries older than maxWaitMs", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const prisma = makePrisma([entry("old", "calm", 200, now)]); // 200s > 120s
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.cancelled).toBe(1);
    expect(prisma.matchmakingQueueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } }),
    );
  });

  it("relaxing threshold lets dissimilar users match only after waiting", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    // 4 users, all different vibes → score between any pair is low; fresh → no match
    const fresh = ["a", "b", "c", "d"].map((id, i) => entry(id, ["calm","energetic","balanced","calm"][i], 1, now));
    const p1 = makePrisma(fresh); prismaTx = p1;
    expect((await new MatchmakingSweepService(p1, { value: cfg } as any).runSweep(now)).formed).toBe(0);
    // same users but each waited ~119s → threshold ~0 → they match
    const aged = ["a", "b", "c", "d"].map((id, i) => entry(id, ["calm","energetic","balanced","calm"][i], 119, now));
    const p2 = makePrisma(aged); prismaTx = p2;
    expect((await new MatchmakingSweepService(p2, { value: cfg } as any).runSweep(now)).formed).toBe(1);
  });

  it("dedupes multiple waiting entries from the same profile", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const dup = [entry("a", "calm", 1, now), { ...entry("a2", "calm", 1, now), profileId: "prof-a" }];
    const rest = ["b", "c", "d"].map((id) => entry(id, "calm", 1, now));
    const prisma = makePrisma([...dup, ...rest]);
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    await svc.runSweep(now);
    // only 4 distinct profiles → party of exactly 4; the duplicate profile appears once
    const createArg = prisma.partyParticipant.createMany.mock.calls[0][0].data;
    const profileIds = createArg.map((d: any) => d.profileId);
    expect(new Set(profileIds).size).toBe(profileIds.length);
  });

  it("caps party size at cfg.max even with more compatible entries", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    // cfg.max=8; seed MAX+3=11 mutually-compatible fresh same-vibe entries
    const entries = Array.from({ length: 11 }, (_, i) => entry(String(i), "calm", 1, now));
    const prisma = makePrisma(entries);
    prismaTx = prisma;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(1);
    const createArg = prisma.partyParticipant.createMany.mock.calls[0][0].data;
    expect(createArg).toHaveLength(cfg.max); // exactly 8, not 11
  });

  it("returns formed=0 when a member is already claimed mid-transaction", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    const waiting = ["a", "b", "c", "d"].map((id) => entry(id, "calm", 1, now));
    // Build a tx mock with "a" pre-claimed so the first claim inside $transaction returns count=0
    const txClaimed = new Set<string>(["a"]);
    const txMock = {
      matchmakingQueueEntry: {
        updateMany: jest.fn(async ({ where }: any) => {
          if (where.id && where.status === "waiting") {
            if (txClaimed.has(where.id)) return { count: 0 };
            txClaimed.add(where.id);
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      party: { create: jest.fn() },
      partyParticipant: { createMany: jest.fn() },
    };
    const prisma = {
      matchmakingQueueEntry: {
        findMany: jest.fn().mockResolvedValue(waiting),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      party: txMock.party,
      partyParticipant: txMock.partyParticipant,
      $transaction: jest.fn(async (fn: any) => fn(txMock)),
    } as any;
    prismaTx = txMock;
    const svc = new MatchmakingSweepService(prisma, { value: cfg } as any);
    const res = await svc.runSweep(now);
    expect(res.formed).toBe(0);
    expect(txMock.partyParticipant.createMany).not.toHaveBeenCalled();
  });
});
