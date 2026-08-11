import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { PrismaService } from "../prisma/prisma.service";
import { PREFERENCE_ANALYZER } from "../ai/preference-analyzer.interface";
import { PreferenceAnalysisError } from "../ai/preference-analyzer.interface";

const mockProfile = {
  id: "profile-1",
  userId: "user-1",
  name: "테스트",
  age: 28,
  gender: "male",
  location: "서울",
  occupation: "developer",
  partyPreferenceText: "활발한 보드게임 모임",
  bio: null,
  photoUrl: null,
  interests: null,
  preferenceSignals: null,
  riskScore: 0,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const stubSignals = { vibe: "calm", activity: [], drinking: "none", pace: "slow", tags: [], summary: "s" };

describe("ProfileService (v2 shape)", () => {
  it("creates a profile with v2 fields and no v1 fields", async () => {
    const created = { id: "p1", partyPreferenceText: "조용한 보드게임 모임" };
    const prisma = {
      profile: {
        create: jest.fn().mockResolvedValue(created),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ ...created, preferenceSignals: stubSignals }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: PREFERENCE_ANALYZER, useValue: { analyze: jest.fn().mockResolvedValue(stubSignals) } },
      ],
    }).compile();
    const service = moduleRef.get(ProfileService);

    const dto = {
      name: "A",
      age: 27,
      gender: "female",
      occupation: "designer",
      partyPreferenceText: "조용한 보드게임 모임",
    } as any;
    await service.create("user-1", dto);

    const arg = prisma.profile.create.mock.calls[0][0].data;
    expect(arg.partyPreferenceText).toBe("조용한 보드게임 모임");
    expect(arg.occupation).toBe("designer");
    expect(arg).not.toHaveProperty("agentPersona");
    expect(arg).not.toHaveProperty("communicationStyle");
    expect(arg).not.toHaveProperty("values");
  });
});

describe("ProfileService", () => {
  let service: ProfileService;
  let prisma: {
    profile: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      profile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: PREFERENCE_ANALYZER, useValue: { analyze: jest.fn().mockResolvedValue(stubSignals) } },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe("create", () => {
    it("should throw ConflictException if user already has a profile", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.create("user-1", {
          name: "테스트",
          age: 28,
          gender: "male",
          occupation: "developer",
          partyPreferenceText: "보드게임",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException on concurrent duplicate (P2002)", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
      prisma.profile.create.mockRejectedValue(p2002);

      await expect(
        service.create("user-1", {
          name: "테스트",
          age: 28,
          gender: "male",
          occupation: "developer",
          partyPreferenceText: "보드게임 선호",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // findOne/findAll(임의 프로필 조회·목록)은 2026-08-11 삭제 — 로그인만 하면 남의 사진까지
  // 볼 수 있어 블라인드 단계가 무력화됐다(profile.controller.ts 주석). 아래 update 테스트가
  // 남은 피어 노출 경로(자기 프로필 수정)를 지킨다.

  describe("update", () => {
    it("should update profile fields", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);
      prisma.profile.update.mockResolvedValue({ ...mockProfile, location: "부산" });

      await service.update("profile-1", "user-1", { location: "부산" });

      expect(prisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "profile-1" },
          data: expect.objectContaining({ location: "부산" }),
        }),
      );
    });

    it("should throw NotFoundException if profile not found", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.update("nonexistent", "user-1", {})).rejects.toThrow(NotFoundException);
    });

    // 2026-08-11: PATCH로 gender를 뒤집으면 반대 성별 큐(남3+여3)에 들어갈 수 있었다.
    it("never writes age/gender even if a client sends them (본인인증이 진실)", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);
      prisma.profile.update.mockResolvedValue(mockProfile);

      await service.update("profile-1", "user-1", {
        gender: "female",
        age: 21,
        occupation: "designer",
      } as any);

      const data = prisma.profile.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("gender");
      expect(data).not.toHaveProperty("age");
      expect(data.occupation).toBe("designer");
    });

    it("rejects a whitespace-only nickname", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(service.update("profile-1", "user-1", { name: "   " })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it("trims the nickname before storing", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);
      prisma.profile.update.mockResolvedValue(mockProfile);

      await service.update("profile-1", "user-1", { name: "  민준  " });

      expect(prisma.profile.update.mock.calls[0][0].data.name).toBe("민준");
    });

    it("rejects a nickname containing markup", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.update("profile-1", "user-1", { name: "<img src=x onerror=alert(1)>" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a photoUrl hosted on someone else's domain", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.update("profile-1", "user-1", {
          photoUrl: "https://evil.example.com/uploads/00000000-0000-4000-8000-000000000000.png",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe("ProfileService (analyzer integration)", () => {
  const signals = { vibe: "calm", activity: ["boardgame"], drinking: "none", pace: "slow", tags: ["quiet"], summary: "s" };
  const baseDto = { name: "A", age: 27, gender: "female", occupation: "designer", partyPreferenceText: "조용한 보드게임" } as any;
  function make(analyzer: any, profileOverrides: any = {}) {
    const created = { id: "p1", userId: "u1", preferenceSignals: null, ...baseDto, ...profileOverrides };
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockImplementation(({ data }) => ({ ...created, ...data })),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    return { service: new ProfileService(prisma as any, analyzer), prisma };
  }

  it("create runs the analyzer and stores signals", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    const out = await service.create("u1", baseDto);
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({ partyPreferenceText: "조용한 보드게임", occupation: "designer" }));
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { preferenceSignals: signals } }));
    expect(out.preferenceSignals).toEqual(signals);
    // riskScore must not appear on any write-path response
    expect(out).not.toHaveProperty("riskScore");
  });

  it("create falls back to null signals when the analyzer throws PreferenceAnalysisError", async () => {
    const analyzer = { analyze: jest.fn().mockRejectedValue(new PreferenceAnalysisError("boom")) };
    const { service, prisma } = make(analyzer);
    const out = await service.create("u1", baseDto);
    expect(prisma.profile.create).toHaveBeenCalled();
    expect(out.preferenceSignals).toBeNull();
    expect(out).not.toHaveProperty("riskScore");
  });

  it("create returns profile with null signals when signal persist (update) fails (I1)", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    prisma.profile.update.mockRejectedValue(new Error("db timeout"));
    // Must not throw — onboarding never hard-fails on a persist hiccup
    const out = await service.create("u1", baseDto);
    expect(out).toBeDefined();
    expect(out.preferenceSignals).toBeNull();
    expect(out).not.toHaveProperty("riskScore");
  });

  it("create throws ConflictException when a profile already exists", async () => {
    const analyzer = { analyze: jest.fn() };
    const { service, prisma } = make(analyzer);
    prisma.profile.findUnique.mockResolvedValue({ id: "existing" });
    await expect(service.create("u1", baseDto)).rejects.toBeInstanceOf(ConflictException);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("create rethrows non-PreferenceAnalysisError errors from the analyzer", async () => {
    const genericError = new Error("db down");
    const analyzer = { analyze: jest.fn().mockRejectedValue(genericError) };
    const { service } = make(analyzer);
    await expect(service.create("u1", baseDto)).rejects.toThrow("db down");
  });

  it("reanalyze throws NotFoundException when no profile exists", async () => {
    const analyzer = { analyze: jest.fn() };
    const { service } = make(analyzer);
    // findUnique returns null by default from make()
    await expect(service.reanalyze("u1")).rejects.toBeInstanceOf(NotFoundException);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it("reanalyze calls analyzer and stores signals when profile exists", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    const existingProfile = { id: "p1", userId: "u1", preferenceSignals: null, ...baseDto };
    prisma.profile.findUnique.mockResolvedValue(existingProfile);
    await service.reanalyze("u1");
    expect(analyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({ partyPreferenceText: "조용한 보드게임" }));
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { preferenceSignals: signals } }));
  });

  it("update triggers re-analysis when partyPreferenceText changes (I3)", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    const existingProfile = { id: "p1", userId: "u1", preferenceSignals: null, ...baseDto };
    prisma.profile.findUnique.mockResolvedValue(existingProfile);
    // Different text → should re-analyze
    await service.update("p1", "u1", { partyPreferenceText: "새로운 선호" });
    expect(analyzer.analyze).toHaveBeenCalled();
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { preferenceSignals: signals } }));
  });

  it("update does NOT re-analyze when partyPreferenceText is unchanged (I3)", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    const existingProfile = { id: "p1", userId: "u1", preferenceSignals: null, ...baseDto };
    prisma.profile.findUnique.mockResolvedValue(existingProfile);
    // Same text as existing → must not trigger analysis
    await service.update("p1", "u1", { partyPreferenceText: baseDto.partyPreferenceText });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });
});
