import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";

// Regression: ISSUE-003 — admin account operations lacked release-gate coverage
// Found by /qa on 2026-08-07
// Report: .gstack/qa-reports/release-readiness-qa-2026-08-07.md
describe("AdminService account operations", () => {
  it("returns dashboard counts from independent queries", async () => {
    const prisma = {
      user: { count: jest.fn().mockResolvedValue(10) },
      profile: { count: jest.fn().mockResolvedValue(8) },
      safetyReport: { count: jest.fn().mockResolvedValue(2) },
    } as any;
    await expect(new AdminService(prisma).getStats()).resolves.toEqual({
      totalUsers: 10,
      activeUsers: 8,
      pendingReports: 2,
    });
  });

  it("filters and safely projects paginated users", async () => {
    const createdAt = new Date("2026-08-07T00:00:00Z");
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "u1",
            email: "one@example.com",
            role: "user",
            createdAt,
            profile: {
              id: "p1",
              name: "하나",
              age: 30,
              gender: "female",
              location: "서울",
              status: "active",
              riskScore: 0,
              privateField: "do-not-return",
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;

    const result = await new AdminService(prisma).listUsers({
      status: "active",
      search: "하나",
      limit: 5,
      offset: 10,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ profile: { status: "active" }, OR: expect.any(Array) }),
        take: 5,
        skip: 10,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ total: 1, limit: 5, offset: 10 }),
    );
    expect(result.users[0].profile).not.toHaveProperty("privateField");
  });

  it("rejects status changes for missing users and users without profiles", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u1", profile: null }) } } as any;
    const subject = new AdminService(prisma);
    await expect(subject.updateUserStatus("missing", "active")).rejects.toBeInstanceOf(NotFoundException);
    await expect(subject.updateUserStatus("u1", "active")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("suspends a profile and revokes every active refresh token transactionally", async () => {
    const tx = {
      profile: { update: jest.fn().mockResolvedValue({ id: "p1", status: "suspended" }) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u1", profile: { id: "p1" } }) },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    } as any;

    await expect(new AdminService(prisma).updateUserStatus("u1", "suspended")).resolves.toEqual({
      id: "p1",
      status: "suspended",
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("soft-deletes a user and revokes sessions", async () => {
    const profileUpdate = jest.fn().mockReturnValue({ op: "profile" });
    const tokenUpdate = jest.fn().mockReturnValue({ op: "tokens" });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u1" }) },
      profile: { updateMany: profileUpdate },
      refreshToken: { updateMany: tokenUpdate },
      $transaction: jest.fn().mockResolvedValue([]),
    } as any;

    await expect(new AdminService(prisma).deleteUser("u1")).resolves.toEqual({ success: true });
    expect(profileUpdate).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { status: "deleted" },
    });
    expect(tokenUpdate).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("throws for a missing user detail", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(new AdminService(prisma).getUserDetail("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
