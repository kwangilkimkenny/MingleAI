import { NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
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
    partyParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
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
    const createSpy = jest.fn().mockResolvedValue(created);
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        partyParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
        matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(null), create: createSpy },
      }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.status).toBe("waiting");
    expect(res.id).toBe("e1");
    expect(createSpy).toHaveBeenCalledWith({ data: expect.objectContaining({ preferenceSnapshot: signals }) });
  });

  it("enqueue → idempotent: returns the existing waiting entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const existing = { id: "eX", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    const createSpy = jest.fn();
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        partyParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
        matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(existing), create: createSpy },
      }));
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.id).toBe("eX");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("enqueue → retries on P2002 (lost the partial-unique race) and returns the now-existing waiting entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    const existing = { id: "eDup", status: "waiting", enqueuedAt: new Date(), matchedPartyId: null };
    let attempt = 0;
    prisma.$transaction.mockImplementation(async (fn: any) => {
      attempt++;
      if (attempt === 1) {
        // no row visible yet; create loses the unique race → P2002
        return fn({
          partyParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
          matchmakingQueueEntry: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" })),
          },
        });
      }
      // retry: the concurrent winner's row is now visible → return it, no second create
      return fn({
        partyParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
        matchmakingQueueEntry: { findFirst: jest.fn().mockResolvedValue(existing), create: jest.fn() },
      });
    });
    const svc = new MatchmakingService(prisma);
    const res = await svc.enqueue("u1");
    expect(res.id).toBe("eDup");
    expect(attempt).toBe(2);
  });

  it("enqueue → ConflictException when profile has an active party membership", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        partyParticipant: { findFirst: jest.fn().mockResolvedValue({ partyId: "party1", profileId: "p1" }) },
        matchmakingQueueEntry: { findFirst: jest.fn(), create: jest.fn() },
      }));
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("enqueue → ConflictException from inside the transaction is NOT swallowed by the P2034 retry loop", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1", preferenceSignals: signals });
    let callCount = 0;
    prisma.$transaction.mockImplementation(async (fn: any) => {
      callCount++;
      return fn({
        partyParticipant: { findFirst: jest.fn().mockResolvedValue({ partyId: "party1", profileId: "p1" }) },
        matchmakingQueueEntry: { findFirst: jest.fn(), create: jest.fn() },
      });
    });
    const svc = new MatchmakingService(prisma);
    await expect(svc.enqueue("u1")).rejects.toBeInstanceOf(ConflictException);
    // Must not loop — ConflictException has no code "P2034"
    expect(callCount).toBe(1);
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

  it("getStatus → returns matched (not cancelled) when profile has both a matched and a younger cancelled entry", async () => {
    const prisma = makePrisma();
    prisma.profile.findUnique.mockResolvedValue({ id: "p1" });
    const matchedEntry = { status: "matched", matchedPartyId: "party1", enqueuedAt: new Date("2026-06-01T00:00:00Z") };
    const cancelledEntry = { status: "cancelled", matchedPartyId: null, enqueuedAt: new Date("2026-06-01T01:00:00Z") };
    // First call: live-status filter → matched entry; second call (fallback) would return cancelled, but should never be reached
    prisma.matchmakingQueueEntry.findFirst = jest.fn()
      .mockResolvedValueOnce(matchedEntry)
      .mockResolvedValueOnce(cancelledEntry);
    prisma.party.findUnique.mockResolvedValue({
      id: "party1", name: "파티", status: "active",
      participants: [{ profile: { id: "p1", name: "A", age: 27, gender: "f", occupation: "dev", photoUrl: null, preferenceSignals: null } }],
    });
    const svc = new MatchmakingService(prisma);
    const res = await svc.getStatus("u1");
    expect(res.status).toBe("matched");
    expect((res as any).matchedPartyId).toBe("party1");
  });
});
