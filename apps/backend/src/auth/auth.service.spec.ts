import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue("mock-token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("register", () => {
    it("should create a new user and return access token", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: "user-1", email: "test@test.com" });
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-pw");

      const result = await service.register("test@test.com", "password123");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: "test@test.com", passwordHash: "hashed-pw" },
      });
      expect(result).toEqual({ accessToken: "mock-token" });
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
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login("test@test.com", "password123");

      expect(result).toEqual({ accessToken: "mock-token" });
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("test@test.com", "wrong")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
