import { NotFoundException, BadRequestException } from "@nestjs/common";
import { MatchmakingService } from "./matchmaking.service";

const signals = { vibe: "calm", drinking: "light", pace: "slow", activity: ["boardgame"], tags: ["quiet"], summary: "조용" };

function makePrisma(overrides: any = {}) {
  return {
    profile: { findUnique: jest.fn() },
    matchmakingQueueEntry: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    party: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(txOf(overrides))),
    ...overrides,
  } as any;
}
function txOf(o: any) {
  return {
    matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "e1", status: "waiting", enqueuedAt: new Date("2026-07-01T00:00:00Z"), matchedPartyId: null }) },
    ...(o.tx ?? {}),
  };
}

describe("MatchmakingService", () => {
  it("enqueue → 404 when the caller has no profile", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue(null);
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enqueue → 400 when preferenceSignals is null", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: null });
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enqueue → creates a waiting entry snapshotting the signals", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const created = { id: "e1", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({ matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) } }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.status).toBe("waiting");
    expect(res.id).toBe("e1");
  });

  it("enqueue → idempotent: returns the existing waiting entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const existing = { id: "eX", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    const createSpy = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({ matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(existing), create: createSpy } }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.id).toBe("eX");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("cancel → 404 when there is no active entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1" });
    prisma.matchmakingQueueEntry.updateMany.mockResolvedValue({ count: 0 });
    const svc = new MatchmakingService(prisma);
    await expect(svc.cancel("u1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("getStatus → matched returns a public party without riskScore or raw signals", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1" });
    prisma.matchmakingQueueEntry.findFirst = jest.fn().mockResolvedValue({ status: "matched", matchedPartyId: "party1", enqueuedAt: new Date() });
    prisma.party.findUnique.mockResolvedValue({
      id: "party1", name: "파티", status: "active",
      participants: [{ profile: { id: "p1", name: "A", age: 27, gender: "non_binary", occupation: "dev", photoUrl: null, riskScore: 0, preferenceSignals: { summary: "조용" } } }],
    });
    const svc = new MatchmakingService(prisma);
    const res = await svc.getStatus("u1");
    expect(res.status).toBe("matched");
    const p = res.party!.participants[0] as any;
    expect(p.preferenceSummary).toBe("조용");
    expect(p.riskScore).toBeUndefined();
    expect(p.preferenceSignals).toBeUndefined();
  });
});
