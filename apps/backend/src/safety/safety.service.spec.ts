import { Test, TestingModule } from "@nestjs/testing";
import { SafetyService } from "./safety.service";
import { PrismaService } from "../prisma/prisma.service";

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
