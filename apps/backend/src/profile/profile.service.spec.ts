import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
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
  };

  beforeEach(async () => {
    prisma = {
      profile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
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

  describe("findOne", () => {
    it("should return a profile by id without riskScore", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.findOne("profile-1");
      // riskScore is an internal field and must not be exposed
      expect(result).not.toHaveProperty("riskScore");
      const { riskScore: _r, ...expected } = mockProfile;
      expect(result).toEqual(expected);
    });

    it("should throw NotFoundException if not found", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException for non-active profiles (M6)", async () => {
      prisma.profile.findUnique.mockResolvedValue({ ...mockProfile, status: "suspended" });

      await expect(service.findOne("profile-1")).rejects.toThrow(NotFoundException);
    });

    it("should use a static error message that does not reflect the supplied id (M7)", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.findOne("injected-id")).rejects.toThrow("프로필을 찾을 수 없습니다");
    });
  });

  describe("findAll", () => {
    it("should return profiles with location filter", async () => {
      prisma.profile.findMany.mockResolvedValue([mockProfile]);

      await service.findAll({ location: "서울" });

      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { contains: "서울", mode: "insensitive" },
            status: "active",
          }),
        }),
      );
    });

    it("should clamp limit to 50 for oversized input", async () => {
      prisma.profile.findMany.mockResolvedValue([]);
      await service.findAll({ limit: 999 });
      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it("should use default limit 20 for non-numeric input (M5)", async () => {
      prisma.profile.findMany.mockResolvedValue([]);
      await service.findAll({ limit: NaN });
      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it("should omit riskScore from each result in findAll", async () => {
      prisma.profile.findMany.mockResolvedValue([mockProfile]);
      const results = await service.findAll({});
      expect(results[0]).not.toHaveProperty("riskScore");
    });
  });

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
  });

  it("create falls back to null signals when the analyzer throws PreferenceAnalysisError", async () => {
    const analyzer = { analyze: jest.fn().mockRejectedValue(new PreferenceAnalysisError("boom")) };
    const { service, prisma } = make(analyzer);
    const out = await service.create("u1", baseDto);
    expect(prisma.profile.create).toHaveBeenCalled();
    expect(out.preferenceSignals).toBeNull();
  });

  it("create returns profile with null signals when signal persist (update) fails (I1)", async () => {
    const analyzer = { analyze: jest.fn().mockResolvedValue(signals) };
    const { service, prisma } = make(analyzer);
    prisma.profile.update.mockRejectedValue(new Error("db timeout"));
    // Must not throw — onboarding never hard-fails on a persist hiccup
    const out = await service.create("u1", baseDto);
    expect(out).toBeDefined();
    expect(out.preferenceSignals).toBeNull();
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
