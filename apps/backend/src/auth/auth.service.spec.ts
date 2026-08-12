import { NotImplementedException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

jest.mock("bcrypt", () => ({ compare: jest.fn() }));

function makeService(prisma: any) {
  const jwt = { sign: jest.fn().mockReturnValue("access-token") } as any;
  const accountAccess = { requireActive: jest.fn().mockResolvedValue({ userId: "u1" }) } as any;
  return new AuthService(prisma, jwt, accountAccess);
}

describe("AuthService.devLogin", () => {
  it("creates a dev user when none exists and issues a session", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "u1", email: "dev@test.com", role: "user" }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const res = await makeService(prisma).devLogin("Dev@Test.com");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "dev@test.com", authProvider: "dev", role: "user" }),
    });
    expect(res).toEqual(
      expect.objectContaining({ accessToken: "access-token", refreshToken: expect.any(String), role: "user" }),
    );
  });

  it("reuses an existing user and upgrades role when requested", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "u1", email: "a@test.com", role: "user" }),
        update: jest.fn().mockResolvedValue({ id: "u1", email: "a@test.com", role: "admin" }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    await makeService(prisma).devLogin("a@test.com", "admin");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "admin" } });
  });
});

describe("AuthService.adminLogin", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    (bcrypt.compare as jest.Mock).mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("throws 501 when admin env is not configured", async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD_HASH;
    const prisma = { user: {} } as any;
    await expect(makeService(prisma).adminLogin("a@b.com", "pw")).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it("throws 401 on password mismatch (and never reveals which field)", async () => {
    process.env.ADMIN_EMAIL = "admin@mingle.com";
    process.env.ADMIN_PASSWORD_HASH = "$2b$10$hash";
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const prisma = { user: { findUnique: jest.fn() } } as any;
    await expect(
      makeService(prisma).adminLogin("admin@mingle.com", "wrong"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws 401 on email mismatch while still comparing the password", async () => {
    process.env.ADMIN_EMAIL = "admin@mingle.com";
    process.env.ADMIN_PASSWORD_HASH = "$2b$10$hash";
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const prisma = { user: { findUnique: jest.fn() } } as any;
    await expect(
      makeService(prisma).adminLogin("intruder@mingle.com", "pw"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bcrypt.compare).toHaveBeenCalled();
  });

  it("issues an admin session on success, creating the identity when missing", async () => {
    process.env.ADMIN_EMAIL = "Admin@Mingle.com";
    process.env.ADMIN_PASSWORD_HASH = "$2b$10$hash";
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: "admin1", email: "admin@mingle.com", role: "admin" }),
      },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const res = await makeService(prisma).adminLogin("admin@mingle.com", "pw");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authProvider: "admin",
        providerId: "admin@mingle.com",
        role: "admin",
      }),
    });
    expect(res).toEqual(
      expect.objectContaining({ accessToken: "access-token", role: "admin" }),
    );
  });
});

describe("AuthService.refresh production identity circuit breaker", () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("revokes refresh sessions for an unverified production consumer", async () => {
    process.env.NODE_ENV = "production";
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: "rt1",
          userId: "u1",
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: "u1",
            email: null,
            role: "user",
            phoneVerifiedAt: null,
            profile: null,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    await expect(makeService(prisma).refresh("raw-token")).rejects.toThrow(
      "본인인증이 완료되지 않은 계정입니다",
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("fails closed and revokes an unverified unknown-role session", async () => {
    process.env.NODE_ENV = "production";
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: "rt1",
          userId: "u1",
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: "u1",
            email: null,
            role: "partner",
            phoneVerifiedAt: null,
            profile: null,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    await expect(makeService(prisma).refresh("raw-token")).rejects.toThrow(
      "본인인증이 완료되지 않은 계정입니다",
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("AuthService.deleteAccount", () => {
  it("deletes without a password (social accounts have none)", async () => {
    const tx = {
      directMessage: { deleteMany: jest.fn() },
      safetyRiskContribution: { deleteMany: jest.fn() },
      safetyReport: { deleteMany: jest.fn() },
      block: { deleteMany: jest.fn() },
      proposal: { deleteMany: jest.fn() },
      partyMessage: { deleteMany: jest.fn() },
      partyParticipant: { deleteMany: jest.fn() },
      matchmakingQueueEntry: { deleteMany: jest.fn() },
      speedDateQueueEntry: { deleteMany: jest.fn() },
      match: { deleteMany: jest.fn() },
      profile: { delete: jest.fn() },
      notification: { deleteMany: jest.fn() },
      user: { delete: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u1", profile: { id: "p1", photoUrl: null } }) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    } as any;
    await makeService(prisma).deleteAccount("u1");
    expect(tx.profile.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(tx.speedDateQueueEntry.deleteMany).toHaveBeenCalled();
  });
});
