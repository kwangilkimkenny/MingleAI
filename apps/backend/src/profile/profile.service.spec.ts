import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { PrismaService } from "../prisma/prisma.service";

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

describe("ProfileService (v2 shape)", () => {
  it("creates a profile with v2 fields and no v1 fields", async () => {
    const created = { id: "p1", partyPreferenceText: "조용한 보드게임 모임" };
    const prisma = {
      profile: {
        create: jest.fn().mockResolvedValue(created),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ProfileService, { provide: PrismaService, useValue: prisma }],
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
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe("create", () => {
    it("should throw BadRequestException if user already has a profile", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.create("user-1", {
          name: "테스트",
          age: 28,
          gender: "male",
          occupation: "developer",
          partyPreferenceText: "보드게임",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("should return a profile by id", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await service.findOne("profile-1");
      expect(result).toEqual(mockProfile);
    });

    it("should throw NotFoundException if not found", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(NotFoundException);
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
