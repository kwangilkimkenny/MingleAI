import { AuthService } from "./auth.service";

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
