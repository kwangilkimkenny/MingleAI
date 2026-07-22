import { BadRequestException } from "@nestjs/common";
import { PartyService } from "./party.service";

const prisma = {
  profile: { findUnique: jest.fn() },
  partyParticipant: { findUnique: jest.fn() },
  partyMessage: { create: jest.fn(), findMany: jest.fn() },
  party: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
} as any;

const service = new PartyService(prisma);
beforeEach(() => jest.clearAllMocks());

const ROW = {
  id: "m1",
  partyId: "pt1",
  profileId: "pf1",
  content: "hi",
  createdAt: new Date("2026-07-09T00:00:00Z"),
};

describe("assertParticipant", () => {
  it("returns the profileId for a participant", async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: "pf1", status: "active" });
    prisma.partyParticipant.findUnique.mockResolvedValue({ partyId: "pt1", profileId: "pf1" });
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBe("pf1");
    expect(prisma.partyParticipant.findUnique).toHaveBeenCalledWith({
      where: { partyId_profileId: { partyId: "pt1", profileId: "pf1" } },
    });
  });
  it("returns null for a non-participant", async () => {
    prisma.profile.findUnique.mockResolvedValue({ id: "pf1", status: "active" });
    prisma.partyParticipant.findUnique.mockResolvedValue(null);
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBeNull();
  });
  it("returns null when the caller has no profile", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    await expect(service.assertParticipant("u1", "pt1")).resolves.toBeNull();
    expect(prisma.partyParticipant.findUnique).not.toHaveBeenCalled();
  });
});

describe("addPartyMessage", () => {
  it("persists a trimmed message and returns the view", async () => {
    prisma.partyMessage.create.mockResolvedValue(ROW);
    const view = await service.addPartyMessage("pf1", "pt1", "  hi  ");
    expect(prisma.partyMessage.create).toHaveBeenCalledWith({
      data: { partyId: "pt1", profileId: "pf1", content: "hi" },
    });
    expect(view).toEqual({
      id: "m1",
      partyId: "pt1",
      profileId: "pf1",
      content: "hi",
      createdAt: "2026-07-09T00:00:00.000Z",
    });
  });
  it("rejects an empty message", async () => {
    await expect(service.addPartyMessage("pf1", "pt1", "   ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it("rejects a message over 2000 chars", async () => {
    await expect(service.addPartyMessage("pf1", "pt1", "a".repeat(2001))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("getPartyMessages", () => {
  it("returns ascending views (desc query reversed) with default limit 50", async () => {
    const older = { ...ROW, id: "m0", createdAt: new Date("2026-07-08T00:00:00Z") };
    prisma.partyMessage.findMany.mockResolvedValue([ROW, older]);
    const list = await service.getPartyMessages("pt1");
    expect(prisma.partyMessage.findMany).toHaveBeenCalledWith({
      where: { partyId: "pt1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    expect(list.map((m) => m.id)).toEqual(["m0", "m1"]);
  });
  it("clamps the limit to 100", async () => {
    prisma.partyMessage.findMany.mockResolvedValue([]);
    await service.getPartyMessages("pt1", 999);
    expect(prisma.partyMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
