import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { SpeedDateQueueService } from "./speed-date-queue.service";

const baseProfile = {
  id: "p1",
  userId: "u1",
  age: 25,
  gender: "male",
  preferenceSignals: { vibe: "calm", drinking: "light", pace: "slow", activity: [], tags: [], summary: "s" },
};

function makePrisma(over: { profile?: any; activeSessions?: any[]; waiting?: any } = {}) {
  const tx = {
    speedDateQueueEntry: {
      findFirst: jest.fn().mockResolvedValue(over.waiting ?? null),
      create: jest.fn().mockResolvedValue({ id: "e1" }),
    },
  };
  return {
    _tx: tx,
    profile: { findUnique: jest.fn().mockResolvedValue(over.profile ?? baseProfile) },
    speedDateSession: { findMany: jest.fn().mockResolvedValue(over.activeSessions ?? []) },
    speedDateQueueEntry: {
      findFirst: jest.fn().mockResolvedValue(over.waiting ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any;
}

describe("SpeedDateQueueService.enqueue", () => {
  it("requires explicit consent", async () => {
    await expect(new SpeedDateQueueService(makePrisma()).enqueue("u1", false)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("requires preference analysis", async () => {
    const prisma = makePrisma({ profile: { ...baseProfile, preferenceSignals: null } });
    await expect(new SpeedDateQueueService(prisma).enqueue("u1", true)).rejects.toThrow(BadRequestException);
  });

  it("blocks under-19 users", async () => {
    const prisma = makePrisma({ profile: { ...baseProfile, age: 18 } });
    await expect(new SpeedDateQueueService(prisma).enqueue("u1", true)).rejects.toThrow(ForbiddenException);
  });

  it("rejects ineligible gender for the v1 hetero 3x3 mode", async () => {
    const prisma = makePrisma({ profile: { ...baseProfile, gender: "nonbinary" } });
    await expect(new SpeedDateQueueService(prisma).enqueue("u1", true)).rejects.toThrow(BadRequestException);
  });

  it("conflicts when already in an active session", async () => {
    const prisma = makePrisma({ activeSessions: [{ id: "s1", state: { participants: [{ profileId: "p1" }] } }] });
    await expect(new SpeedDateQueueService(prisma).enqueue("u1", true)).rejects.toThrow(ConflictException);
  });

  it("creates a waiting entry for an eligible profile", async () => {
    const prisma = makePrisma();
    await expect(new SpeedDateQueueService(prisma).enqueue("u1", true)).resolves.toEqual({ status: "waiting" });
    expect(prisma._tx.speedDateQueueEntry.create).toHaveBeenCalled();
  });

  it("is idempotent when a waiting entry already exists", async () => {
    const prisma = makePrisma({ waiting: { id: "e0" } });
    await new SpeedDateQueueService(prisma).enqueue("u1", true);
    expect(prisma._tx.speedDateQueueEntry.create).not.toHaveBeenCalled();
  });
});

describe("SpeedDateQueueService.getStatus", () => {
  it("reports matched with the active session id", async () => {
    const prisma = makePrisma({ activeSessions: [{ id: "s1", state: { participants: [{ profileId: "p1" }] } }] });
    expect(await new SpeedDateQueueService(prisma).getStatus("u1")).toEqual({
      status: "matched",
      sessionId: "s1",
      since: null,
    });
  });

  it("reports waiting with an enqueue timestamp", async () => {
    const enqueuedAt = new Date("2026-07-22T00:00:00Z");
    const prisma = makePrisma({ waiting: { id: "e1", enqueuedAt } });
    expect(await new SpeedDateQueueService(prisma).getStatus("u1")).toEqual({
      status: "waiting",
      sessionId: null,
      since: enqueuedAt.getTime(),
    });
  });

  it("reports idle otherwise", async () => {
    expect(await new SpeedDateQueueService(makePrisma()).getStatus("u1")).toEqual({
      status: "idle",
      sessionId: null,
      since: null,
    });
  });
});
