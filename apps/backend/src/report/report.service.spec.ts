import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ReportService } from "./report.service";
import { PrismaService } from "../prisma/prisma.service";

const profileA = {
  id: "p1",
  name: "유저A",
  values: { relationshipGoal: "serious", lifestyle: ["운동", "독서"], importantValues: ["성실함", "유머"] },
  communicationStyle: { tone: "warm", topics: ["여행", "음식"] },
};

const profileB = {
  id: "p2",
  name: "유저B",
  values: { relationshipGoal: "serious", lifestyle: ["독서", "요리"], importantValues: ["성실함", "배려"] },
  communicationStyle: { tone: "thoughtful", topics: ["음식", "문화"] },
};

const mockPartyWithResults = {
  id: "party-1",
  results: {
    rounds: [],
    interactionSignals: [
      { fromProfileId: "p1", toProfileId: "p2", signalType: "shared_value", strength: 0.8, context: "공유 가치관: 성실함" },
      { fromProfileId: "p1", toProfileId: "p2", signalType: "interest", strength: 0.6, context: "공유 관심사: 음식" },
      { fromProfileId: "p1", toProfileId: "p2", signalType: "deep_conversation", strength: 0.8, context: "관계 목표 일치: serious" },
    ],
  },
};

describe("ReportService", () => {
  let service: ReportService;
  let prisma: {
    party: { findUnique: jest.Mock };
    profile: { findUnique: jest.Mock };
    partyParticipant: { findUnique: jest.Mock };
    report: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      party: { findUnique: jest.fn() },
      profile: { findUnique: jest.fn() },
      partyParticipant: { findUnique: jest.fn() },
      report: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe("generate", () => {
    it("should generate a report with match scores", async () => {
      prisma.party.findUnique.mockResolvedValue(mockPartyWithResults);
      prisma.profile.findUnique
        .mockResolvedValueOnce(profileA) // user
        .mockResolvedValueOnce(profileB); // partner
      prisma.partyParticipant.findUnique.mockResolvedValue({ partyId: "party-1", profileId: "p1" });
      prisma.report.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "report-1", ...data }),
      );

      const result = await service.generate("party-1", "p1", "summary");

      expect(prisma.report.create).toHaveBeenCalled();
      const createData = prisma.report.create.mock.calls[0][0].data;
      expect(createData.matchScores).toHaveLength(1);
      expect(createData.matchScores[0].partnerId).toBe("p2");
      expect(createData.matchScores[0].overallScore).toBeGreaterThan(0);
      expect(createData.matchScores[0].breakdown).toBeDefined();
      expect(createData.highlights).toHaveLength(1);
      expect(createData.recommendations).toHaveLength(1);
    });

    it("should throw if party not found", async () => {
      prisma.party.findUnique.mockResolvedValue(null);
      await expect(service.generate("nonexistent", "p1")).rejects.toThrow(NotFoundException);
    });

    it("should throw if party has no results", async () => {
      prisma.party.findUnique.mockResolvedValue({ id: "party-1", results: null });
      await expect(service.generate("party-1", "p1")).rejects.toThrow(BadRequestException);
    });

    it("should throw if profile did not participate", async () => {
      prisma.party.findUnique.mockResolvedValue(mockPartyWithResults);
      prisma.profile.findUnique.mockResolvedValue(profileA);
      prisma.partyParticipant.findUnique.mockResolvedValue(null);

      await expect(service.generate("party-1", "p1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("should return a report by id", async () => {
      const mockReport = { id: "report-1", reportType: "summary" };
      prisma.report.findUnique.mockResolvedValue(mockReport);

      const result = await service.findOne("report-1");
      expect(result).toEqual(mockReport);
    });

    it("should throw NotFoundException if not found", async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.findOne("nonexistent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByProfile", () => {
    it("should return reports for a profile", async () => {
      prisma.report.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);

      const result = await service.findByProfile("p1", 10, 0);
      expect(result).toHaveLength(2);
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: "p1" },
          take: 10,
          skip: 0,
        }),
      );
    });
  });
});
