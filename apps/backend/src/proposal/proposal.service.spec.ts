import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { ProposalService } from "./proposal.service";

const cfg = { get: (k: string) => ({ PROPOSAL_WINDOW_HOURS: "24", PROPOSAL_MAX_PER_PARTY: "3" }[k]) } as any;
const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
const notify = { create: jest.fn().mockResolvedValue({}) } as any;

function svcWith(prisma: any) {
  return new ProposalService(prisma, cfg, safety, notify);
}
const meProfile = { id: "pa", userId: "ua" };

it("send → 400 when proposing to self", async () => {
  const prisma = { profile: { findUnique: jest.fn().mockResolvedValue(meProfile) } } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pa")).rejects.toBeInstanceOf(BadRequestException);
});

it("send → 403 when the two are not co-participants of an eligible party", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue(null) }, // no eligible party with both
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 403 when blocked either direction", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 409 when the caller is over PROPOSAL_MAX_PER_PARTY", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(3), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ConflictException);
});

it("send → 409 when the pair is already matched", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    match: { findUnique: jest.fn().mockResolvedValue({ id: "m1" }) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ConflictException);
});

it("send → 409 on a duplicate proposal", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue({ id: "prop0" }), create: jest.fn() },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ConflictException);
});

it("send → creates a pending proposal on the happy path", async () => {
  const senderProfile = { id: "pa", userId: "ua" };
  const recipientProfile = { id: "pb", userId: "ub" };
  const prisma = {
    profile: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: Record<string, string> }) => {
        if (where.userId) return Promise.resolve(senderProfile);
        if (where.id === "pb") return Promise.resolve(recipientProfile);
        return Promise.resolve(null);
      }),
    },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "prop1", status: "pending" }) },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  notify.create.mockClear();
  const res = await svcWith(prisma).send("ua", "party1", "pb");
  expect(res.status).toBe("pending");
  expect(prisma.proposal.create).toHaveBeenCalled();
  expect(notify.create).toHaveBeenCalledWith(
    expect.objectContaining({ type: "proposal_received", userId: "ub" }),
  );
});

it("decline → 404 when the caller is not the recipient of a pending proposal", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    proposal: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  } as any;
  await expect(svcWith(prisma).decline("ua", "propX")).rejects.toBeInstanceOf(NotFoundException);
});

const senderProfile = {
  id: "pa", name: "Alice", age: 25, gender: "female", occupation: "designer",
  photoUrl: null, preferenceSignals: { summary: "likes music" },
};
const recipientProfile = {
  id: "pb", name: "Bob", age: 27, gender: "male", occupation: "engineer",
  photoUrl: "https://example.com/bob.jpg", preferenceSignals: null,
};

it("listReceived → returns ProposalView[] with peer (sender) — no riskScore/preferenceSignals", async () => {
  const row = {
    id: "prop1", partyId: "party1", status: "pending",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    from: senderProfile,
  };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    proposal: { findMany: jest.fn().mockResolvedValue([row]) },
  } as any;
  const result = await svcWith(prisma).listReceived("ua");
  expect(result).toHaveLength(1);
  expect(result[0].peer.name).toBe("Alice");
  expect(result[0].peer.profileId).toBe("pa");
  expect(result[0].peer.preferenceSummary).toBe("likes music");
  expect(result[0].createdAt).toBe("2025-01-01T00:00:00.000Z");
  expect(result[0]).not.toHaveProperty("riskScore");
  expect(result[0].peer).not.toHaveProperty("riskScore");
  expect(result[0].peer).not.toHaveProperty("preferenceSignals");
  expect(prisma.proposal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ include: { from: true } }),
  );
});

it("listSent → returns ProposalView[] with peer (recipient) — no riskScore/preferenceSignals", async () => {
  const row = {
    id: "prop2", partyId: "party1", status: "pending",
    createdAt: new Date("2025-02-01T00:00:00Z"),
    to: recipientProfile,
  };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    proposal: { findMany: jest.fn().mockResolvedValue([row]) },
  } as any;
  const result = await svcWith(prisma).listSent("ua");
  expect(result).toHaveLength(1);
  expect(result[0].peer.name).toBe("Bob");
  expect(result[0].peer.profileId).toBe("pb");
  expect(result[0].peer.photoUrl).toBe("https://example.com/bob.jpg");
  expect(result[0].peer.preferenceSummary).toBeUndefined();
  expect(result[0].peer).not.toHaveProperty("riskScore");
  expect(result[0].peer).not.toHaveProperty("preferenceSignals");
  expect(prisma.proposal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ include: { to: true } }),
  );
});

it("send → notification failure does not reject the send (proposal row is returned)", async () => {
  notify.create.mockRejectedValueOnce(new Error("notify down"));
  const prisma = {
    profile: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: Record<string, string> }) => {
        if (where.userId) return Promise.resolve({ id: "pa", userId: "ua" });
        if (where.id === "pb") return Promise.resolve({ id: "pb", userId: "ub" });
        return Promise.resolve(null);
      }),
    },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "prop3", status: "pending" }) },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  const res = await svcWith(prisma).send("ua", "party1", "pb");
  expect(res.id).toBe("prop3");
});
