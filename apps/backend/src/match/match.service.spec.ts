import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { blockPairKey } from "@mingle/shared";
import { MatchService } from "./match.service";

const notify = { create: jest.fn().mockResolvedValue({}) } as any;
const safety = {
  blocksForProfiles: jest.fn().mockResolvedValue(new Set()),
  isBlockedBetween: jest.fn().mockResolvedValue(false),
} as any;

beforeEach(() => jest.clearAllMocks());

it("acceptProposal → status-guards the proposal, creates a normalized Match + room, notifies both distinct users (outside tx)", async () => {
  const proposal = { id: "prop1", partyId: "party1", fromProfileId: "pb", toProfileId: "pa" };
  const tx = {
    proposal: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue(proposal) },
    match: { upsert: jest.fn().mockResolvedValue({ id: "m1", profileId1: "pa", profileId2: "pb" }) },
    directMessageRoom: { upsert: jest.fn().mockResolvedValue({ id: "r1", matchId: "m1" }) },
  };
  // Two profiles resolve to distinct userIds so we can assert both are notified.
  // Index by whichever key arrives in the `where` clause (userId or id).
  const profileByKey: Record<string, { id: string; userId: string }> = {
    ua: { id: "pa", userId: "ua" }, // where: { userId: "ua" }
    pa: { id: "pa", userId: "ua" }, // where: { id: "pa" }
    pb: { id: "pb", userId: "ub" }, // where: { id: "pb" }
  };
  const prisma = {
    profile: { findUnique: jest.fn(({ where }: any) => Promise.resolve(profileByKey[where.userId ?? where.id] ?? null)) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    match: { findUnique: jest.fn() },
  } as any;
  const svc = new MatchService(prisma, notify, safety);
  const res = await svc.acceptProposal("ua", "prop1");
  expect(res).toEqual({ matchId: "m1", roomId: "r1" });
  // normalized ordering: pa < pb → profileId1 = "pa"
  expect(tx.match.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ create: expect.objectContaining({ profileId1: "pa", profileId2: "pb" }) }),
  );
  // both users notified with distinct userIds
  expect(notify.create).toHaveBeenCalledTimes(2);
  const notifiedUserIds = (notify.create as jest.Mock).mock.calls.map((c: any) => c[0].userId);
  expect(new Set(notifiedUserIds).size).toBe(2); // two distinct userIds
});

it("acceptProposal → 404 when the caller is not the pending recipient", async () => {
  const tx = { proposal: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any;
  await expect(new MatchService(prisma, notify, safety).acceptProposal("ua", "prop1")).rejects.toBeInstanceOf(NotFoundException);
});

it("acceptProposal → 403 when the pair is blocked, creating no match or room (F3)", async () => {
  const proposal = { id: "prop1", partyId: "party1", fromProfileId: "pb", toProfileId: "pa" };
  const tx = {
    proposal: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(proposal),
    },
    match: { upsert: jest.fn() },
    directMessageRoom: { upsert: jest.fn() },
  };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any;
  const blockedSafety = {
    blocksForProfiles: jest.fn(),
    isBlockedBetween: jest.fn().mockResolvedValue(true),
  } as any;
  await expect(
    new MatchService(prisma, notify, blockedSafety).acceptProposal("ua", "prop1"),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(blockedSafety.isBlockedBetween).toHaveBeenCalledWith("pb", "pa");
  expect(tx.match.upsert).not.toHaveBeenCalled();
  expect(tx.directMessageRoom.upsert).not.toHaveBeenCalled();
  expect(notify.create).not.toHaveBeenCalled();
});

it("listMyMatches → hides a room whose peer is blocked", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    match: {
      findMany: jest.fn().mockResolvedValue([
        { id: "m1", profileId1: "pa", profileId2: "pb", room: { id: "r1", messages: [] }, profile1: { id: "pa" }, profile2: { id: "pb", name: "B", age: 20, gender: "female", occupation: "x", photoUrl: null, preferenceSignals: null } },
      ]),
    },
    directMessage: { count: jest.fn().mockResolvedValue(0) },
  } as any;
  const blockedSafety = { blocksForProfiles: jest.fn().mockResolvedValue(new Set([blockPairKey("pa", "pb")])) } as any;
  const res = await new MatchService(prisma, notify, blockedSafety).listMyMatches("ua");
  expect(res).toHaveLength(0);
});
