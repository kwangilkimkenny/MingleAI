import { NotFoundException } from "@nestjs/common";
import { MatchService } from "./match.service";

// Regression: ISSUE-003 — match creation idempotency and failure paths lacked direct coverage
// Found by /qa on 2026-08-07
// Report: .gstack/qa-reports/release-readiness-qa-2026-08-07.md
describe("MatchService release paths", () => {
  const notifications = { create: jest.fn().mockResolvedValue({}) };

  beforeEach(() => jest.clearAllMocks());

  function creationService(options: { blocked?: boolean; prior?: unknown } = {}) {
    const tx = {
      match: {
        findUnique: jest.fn().mockResolvedValue(options.prior ?? null),
        upsert: jest.fn().mockResolvedValue({ id: "m1" }),
      },
      directMessageRoom: {
        upsert: jest.fn().mockResolvedValue({ id: "r1" }),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
      profile: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: "pa", userId: "ua" })
          .mockResolvedValueOnce({ id: "pb", userId: "ub" }),
      },
    } as any;
    const safety = {
      isBlockedBetween: jest.fn().mockResolvedValue(options.blocked ?? false),
    } as any;
    return { service: new MatchService(prisma, notifications as any, safety), prisma, tx, safety };
  }

  it("rejects self matches without touching persistence", async () => {
    const { service, prisma, safety } = creationService();
    await expect(service.createMatch("pa", "pa")).resolves.toBeNull();
    expect(safety.isBlockedBetween).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects blocked pairs before opening a transaction", async () => {
    const { service, prisma } = creationService({ blocked: true });
    await expect(service.createMatch("pa", "pb")).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("normalizes the pair, creates a room, and notifies both users once", async () => {
    const { service, tx } = creationService();
    await expect(service.createMatch("pb", "pa")).resolves.toEqual({ matchId: "m1", roomId: "r1" });
    expect(tx.match.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { profileId1: "pa", profileId2: "pb" } }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: "ua", data: { matchId: "m1", roomId: "r1" } }),
    );
  });

  it("does not send duplicate notifications for an existing match", async () => {
    const { service } = creationService({ prior: { id: "m1" } });
    await service.createMatch("pa", "pb");
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("returns the match even when notification delivery fails", async () => {
    notifications.create.mockRejectedValueOnce(new Error("push offline"));
    const { service } = creationService();
    await expect(service.createMatch("pa", "pb")).resolves.toEqual({ matchId: "m1", roomId: "r1" });
  });

  it("throws a clear error when listing matches without a profile", async () => {
    const prisma = { profile: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const safety = { blocksForProfiles: jest.fn() } as any;
    await expect(
      new MatchService(prisma, notifications as any, safety).listMyMatches("u1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("projects the peer and serializes the latest message timestamps", async () => {
    const createdAt = new Date("2026-08-07T00:00:00.000Z");
    const readAt = new Date("2026-08-07T00:01:00.000Z");
    const prisma = {
      profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa" }) },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "m1",
            profileId1: "pa",
            profileId2: "pb",
            room: { id: "r1", messages: [{ id: "msg", createdAt, readAt }] },
            profile1: { id: "pa" },
            profile2: {
              id: "pb",
              name: "비",
              age: 28,
              gender: "female",
              occupation: "개발자",
              photoUrl: null,
              preferenceSignals: { summary: "차분한 대화" },
            },
          },
        ]),
      },
      directMessage: { count: jest.fn().mockResolvedValue(2) },
    } as any;
    const safety = { blocksForProfiles: jest.fn().mockResolvedValue(new Set()) } as any;

    const [summary] = await new MatchService(prisma, notifications as any, safety).listMyMatches("ua");

    expect(summary).toEqual(
      expect.objectContaining({
        matchId: "m1",
        roomId: "r1",
        unreadCount: 2,
        peer: expect.objectContaining({ profileId: "pb", preferenceSummary: "차분한 대화" }),
        lastMessage: expect.objectContaining({
          createdAt: createdAt.toISOString(),
          readAt: readAt.toISOString(),
        }),
      }),
    );
  });
});
