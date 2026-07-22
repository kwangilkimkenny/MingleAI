import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AccountAccessService } from "./account-access.service";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: { create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    jwt = { sign: jest.fn().mockReturnValue("mock-token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: AccountAccessService,
          useValue: { requireActive: jest.fn().mockResolvedValue({ userId: "user-1" }) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("should create a new user and return access token", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: "user-1", email: "test@test.com", role: "user" });
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-pw");

      const result = await service.register("test@test.com", "password123");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@test.com",
          passwordHash: "hashed-pw",
          termsVersion: "2026-07-22",
          privacyVersion: "2026-07-22",
        }),
      });
      expect(result).toEqual(expect.objectContaining({
        accessToken: "mock-token",
        refreshToken: expect.any(String),
        expiresIn: 3600,
        role: "user",
      }));
    });

    it("should throw ConflictException if email already exists", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(service.register("test@test.com", "password123")).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("login", () => {
    it("should return access token for valid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        passwordHash: "hashed",
        role: "user",
        profile: { status: "active" },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("test@test.com", "password123");

      expect(result).toEqual(expect.objectContaining({ accessToken: "mock-token", role: "user" }));
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("test@test.com", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
