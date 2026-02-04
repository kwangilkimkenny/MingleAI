import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { PartyService } from "./party.service";
import { PrismaService } from "../prisma/prisma.service";

const mockParty = {
  id: "party-1",
  name: "테스트 파티",
  scheduledAt: new Date(),
  maxParticipants: 20,
  theme: "여행",
  roundCount: 2,
  roundDurationMinutes: 10,
  status: "scheduled",
  results: null,
};

const mockProfiles = [
  {
    profile: {
      id: "p1",
      name: "유저A",
      agentPersona: "따뜻하고 활발한 28세 남성",
      preferences: { locationRadius: 50 },
      values: { relationshipGoal: "serious", lifestyle: ["운동", "독서"], importantValues: ["성실함", "유머"] },
      communicationStyle: { tone: "warm", topics: ["여행", "음식"] },
    },
  },
  {
    profile: {
      id: "p2",
      name: "유저B",
      agentPersona: "차분하고 지적인 26세 여성",
      preferences: { locationRadius: 30 },
      values: { relationshipGoal: "serious", lifestyle: ["독서", "요리"], importantValues: ["성실함", "배려"] },
      communicationStyle: { tone: "thoughtful", topics: ["음식", "문화"] },
    },
  },
];

describe("PartyService", () => {
  let service: PartyService;
  let prisma: {
    party: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    profile: { findUnique: jest.Mock };
    partyParticipant: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      party: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      profile: { findUnique: jest.fn() },
      partyParticipant: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PartyService>(PartyService);
  });

  describe("create", () => {
    it("should create a party", async () => {
      prisma.party.create.mockResolvedValue(mockParty);

      const result = await service.create({
        name: "테스트 파티",
        scheduledAt: "2026-03-01T18:00:00Z",
      });

      expect(prisma.party.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "테스트 파티" }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a party", async () => {
      prisma.party.findUnique.mockResolvedValue(mockParty);
      const result = await service.findOne("party-1");
      expect(result).toEqual(mockParty);
    });

    it("should throw NotFoundException if not found", async () => {
      prisma.party.findUnique.mockResolvedValue(null);
      await expect(service.findOne("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("addParticipant", () => {
    it("should add a participant to a scheduled party", async () => {
      prisma.party.findUnique.mockResolvedValue(mockParty);
      prisma.profile.findUnique.mockResolvedValue({ id: "p1", status: "active" });
      prisma.partyParticipant.count.mockResolvedValue(3);
      prisma.partyParticipant.create.mockResolvedValue({});

      const result = await service.addParticipant("party-1", "p1");
      expect(result).toEqual({ participantCount: 4 });
    });

    it("should reject if party is not scheduled", async () => {
      prisma.party.findUnique.mockResolvedValue({ ...mockParty, status: "completed" });

      await expect(service.addParticipant("party-1", "p1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject if party is full", async () => {
      prisma.party.findUnique.mockResolvedValue({ ...mockParty, maxParticipants: 2 });
      prisma.profile.findUnique.mockResolvedValue({ id: "p1", status: "active" });
      prisma.partyParticipant.count.mockResolvedValue(2);

      await expect(service.addParticipant("party-1", "p1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("run", () => {
    it("should run the party and generate results", async () => {
      prisma.party.findUnique.mockResolvedValue(mockParty);
      prisma.partyParticipant.findMany.mockResolvedValue(mockProfiles);
      prisma.party.update.mockImplementation(({ data }) => Promise.resolve({ ...mockParty, ...data }));

      const result = await service.run("party-1");

      expect(prisma.party.update).toHaveBeenCalledTimes(2); // status + results
      const finalUpdate = prisma.party.update.mock.calls[1][0];
      expect(finalUpdate.data.status).toBe("completed");
      expect(finalUpdate.data.results).toBeDefined();
      expect(finalUpdate.data.results.rounds).toHaveLength(2);
      expect(finalUpdate.data.results.interactionSignals.length).toBeGreaterThan(0);
    });

    it("should reject with fewer than 2 participants", async () => {
      prisma.party.findUnique.mockResolvedValue(mockParty);
      prisma.partyParticipant.findMany.mockResolvedValue([mockProfiles[0]]);

      await expect(service.run("party-1")).rejects.toThrow(BadRequestException);
    });
  });
});
