import { Test, TestingModule } from "@nestjs/testing";
import { SafetyService } from "./safety.service";
import { PrismaService } from "../prisma/prisma.service";
import { blockPairKey } from "@mingle/shared";

describe("SafetyService", () => {
  let service: SafetyService;
  let prisma: {
    safetyReport: { create: jest.Mock };
    profile: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      safetyReport: { create: jest.fn() },
      profile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  });

  describe("checkContent", () => {
    it("should return safe for clean content", () => {
      const result = service.checkContent("안녕하세요, 만나서 반갑습니다!", "profile_bio");
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect phone numbers", () => {
      const result = service.checkContent("제 번호는 010-1234-5678 입니다", "conversation");
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.type === "personal_info_leak")).toBe(true);
    });

    it("should detect email addresses", () => {
      const result = service.checkContent("이메일: user@example.com", "message");
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.type === "personal_info_leak")).toBe(true);
    });

    it("should detect harmful content", () => {
      const result = service.checkContent("바보 멍청이 죽어", "conversation");
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.type === "harassment")).toBe(true);
    });

    it("should detect money-related scam signals", () => {
      const result = service.checkContent("계좌번호로 송금해주세요", "message");
      expect(result.safe).toBe(false);
      expect(result.violations.some((v) => v.type === "fraud_signal")).toBe(true);
    });
  });

  describe("reportUser", () => {
    it("should create a safety report and increment risk score", async () => {
      prisma.profile.findUnique
        .mockResolvedValueOnce({ id: "reported-1", riskScore: 0 })   // initial check
        .mockResolvedValueOnce({ id: "reported-1", riskScore: 0.2 }); // after increment
      prisma.profile.update.mockResolvedValue({ id: "reported-1", riskScore: 0.2 });
      prisma.safetyReport.create.mockResolvedValue({ id: "report-1" });

      await service.reportUser("reporter-1", "reported-1", "harassment", "상세 내용");

      expect(prisma.safetyReport.create).toHaveBeenCalled();
      expect(prisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "reported-1" },
          data: { riskScore: { increment: 0.2 } },
        }),
      );
    });

    it("should auto-suspend when risk score reaches threshold", async () => {
      prisma.profile.findUnique
        .mockResolvedValueOnce({ id: "reported-1", riskScore: 0.9 })  // initial check
        .mockResolvedValueOnce({ id: "reported-1", riskScore: 1.1 }); // after increment, >= 1.0
      prisma.profile.update.mockResolvedValue({});
      prisma.safetyReport.create.mockResolvedValue({ id: "report-2" });

      await service.reportUser("reporter-1", "reported-1", "fraud");

      expect(prisma.profile.update).toHaveBeenCalledTimes(2);
      expect(prisma.profile.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { status: "suspended" },
        }),
      );
    });
  });
});

describe("SafetyService — Block", () => {
  it("creates a block between two profiles", async () => {
    const prisma = { block: { create: jest.fn().mockResolvedValue({ id: "b1" }) } } as any;
    const service = new SafetyService(prisma);
    await service.createBlock("blocker-1", "blocked-2");
    expect(prisma.block.create).toHaveBeenCalledWith({
      data: { blockerProfileId: "blocker-1", blockedProfileId: "blocked-2" },
    });
  });

  it("lists blocks for a profile — returns PeerProfile[] with blocked profile data", async () => {
    const blockedProfile = {
      id: "blocked-2", name: "Carol", age: 24, gender: "female",
      occupation: "artist", photoUrl: null, preferenceSignals: null,
    };
    const blocks = [{ id: "b1", blockerProfileId: "blocker-1", blockedProfileId: "blocked-2", blocked: blockedProfile }];
    const prisma = { block: { findMany: jest.fn().mockResolvedValue(blocks) } } as any;
    const service = new SafetyService(prisma);
    const result = await service.listBlocks("blocker-1");
    expect(prisma.block.findMany).toHaveBeenCalledWith({
      where: { blockerProfileId: "blocker-1" },
      include: { blocked: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Carol");
    expect(result[0].profileId).toBe("blocked-2");
    expect(result[0]).not.toHaveProperty("riskScore");
    expect(result[0]).not.toHaveProperty("id");
  });
});

describe("SafetyService — block queries", () => {
  it("isBlockedBetween is true when a block exists in EITHER direction", async () => {
    const prisma = { block: { findFirst: jest.fn().mockResolvedValue({ id: "b1" }) } } as any;
    const service = new SafetyService(prisma);
    await expect(service.isBlockedBetween("a", "b")).resolves.toBe(true);
    expect(prisma.block.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerProfileId: "a", blockedProfileId: "b" },
          { blockerProfileId: "b", blockedProfileId: "a" },
        ],
      },
    });
  });

  it("isBlockedBetween is false when no block row exists", async () => {
    const prisma = { block: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new SafetyService(prisma);
    await expect(service.isBlockedBetween("a", "b")).resolves.toBe(false);
  });

  it("blocksForProfiles returns order-independent pair keys", async () => {
    const prisma = {
      block: {
        findMany: jest.fn().mockResolvedValue([{ blockerProfileId: "b", blockedProfileId: "a" }]),
      },
    } as any;
    const service = new SafetyService(prisma);
    const set = await service.blocksForProfiles(["a", "b", "c"]);
    expect(set.has(blockPairKey("a", "b"))).toBe(true);
    expect(set.has(blockPairKey("a", "c"))).toBe(false);
    expect(prisma.block.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { blockerProfileId: { in: ["a", "b", "c"] }, blockedProfileId: { in: ["a", "b", "c"] } },
    }));
  });
});
