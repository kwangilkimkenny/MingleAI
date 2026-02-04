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
  preferences: { ageRange: { min: 25, max: 35 }, genderPreference: ["female"], locationRadius: 50 },
  values: { relationshipGoal: "serious", lifestyle: ["운동", "독서"], importantValues: ["성실함"] },
  communicationStyle: { tone: "warm", topics: ["여행", "음식"] },
  agentPersona: "",
  riskScore: 0,
  status: "active",
};

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
    it("should create a profile with generated agent persona", async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.profile.create.mockImplementation(({ data }) => Promise.resolve({ id: "profile-1", ...data }));

      const result = await service.create("user-1", {
        name: "테스트",
        age: 28,
        gender: "male",
        location: "서울",
        preferences: { ageRange: { min: 25, max: 35 }, genderPreference: ["female"], locationRadius: 50 },
        values: { relationshipGoal: "serious", lifestyle: ["운동"], importantValues: ["성실함"] },
        communicationStyle: { tone: "warm", topics: ["여행"] },
      });

      expect(prisma.profile.create).toHaveBeenCalled();
      const createCall = prisma.profile.create.mock.calls[0][0];
      expect(createCall.data.agentPersona).toBeTruthy();
      expect(createCall.data.userId).toBe("user-1");
    });

    it("should throw ConflictException if user already has a profile", async () => {
      prisma.profile.findUnique.mockResolvedValue(mockProfile);

      await expect(
        service.create("user-1", {
          name: "테스트",
          age: 28,
          gender: "male",
          location: "서울",
          preferences: { ageRange: { min: 25, max: 35 }, genderPreference: ["female"], locationRadius: 50 },
          values: { relationshipGoal: "serious", lifestyle: [], importantValues: [] },
          communicationStyle: { tone: "warm", topics: [] },
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
    it("should return profiles with filters", async () => {
      prisma.profile.findMany.mockResolvedValue([mockProfile]);

      const result = await service.findAll({ location: "서울" });

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

      const result = await service.update("profile-1", "user-1", { location: "부산" });

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
