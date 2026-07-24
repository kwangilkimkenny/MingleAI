import { NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";

function makeService(prisma: any) {
  return new AdminService(prisma);
}

describe("AdminService safety moderation", () => {
  it("filters reports by status", async () => {
    const prisma = {
      safetyReport: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    await makeService(prisma).listSafetyReports({ status: "pending" });
    expect(prisma.safetyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending" } }),
    );
  });

  it("projects only the safe party fields in the list", async () => {
    const prisma = {
      safetyReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "r1",
            reason: "harassment",
            details: "x",
            status: "pending",
            createdAt: new Date(),
            reporter: { id: "p1", name: "A", age: 25, gender: "male", riskScore: 9 },
            reported: { id: "p2", name: "B", age: 27, gender: "female", userId: "u2" },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any;
    const res = await makeService(prisma).listSafetyReports();
    expect(res.reports[0].reporter).toEqual({
      profileId: "p1",
      name: "A",
      age: 25,
      gender: "male",
    });
    expect(res.reports[0].reported).not.toHaveProperty("userId");
  });

  it("returns cumulative report count and reported status in detail", async () => {
    const prisma = {
      safetyReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: "r1",
          reason: "harassment",
          details: null,
          evidencePartyId: null,
          status: "pending",
          createdAt: new Date(),
          reportedProfileId: "p2",
          reporter: { id: "p1", name: "A", age: 25, gender: "male" },
          reported: { id: "p2", name: "B", age: 27, gender: "female", status: "active" },
        }),
        count: jest.fn().mockResolvedValue(3),
      },
    } as any;
    const detail = await makeService(prisma).getSafetyReportDetail("r1");
    expect(prisma.safetyReport.count).toHaveBeenCalledWith({
      where: { reportedProfileId: "p2" },
    });
    expect(detail.reportsAgainstReported).toBe(3);
    expect(detail.reported).toEqual(
      expect.objectContaining({ profileId: "p2", status: "active" }),
    );
    expect(detail.reporter).toEqual(
      expect.objectContaining({ profileId: "p1", name: "A", age: 25, gender: "male" }),
    );
  });

  it("throws when the report is missing", async () => {
    const prisma = {
      safetyReport: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    await expect(makeService(prisma).getSafetyReportDetail("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("suspends the reported profile and revokes sessions when action=suspend", async () => {
    const prisma = {
      safetyReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: "r1",
          reportedProfileId: "p2",
          reported: { userId: "u2" },
        }),
        update: jest.fn().mockResolvedValue({ id: "r1", status: "resolved" }),
      },
      profile: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    } as any;
    await makeService(prisma).resolveSafetyReport("r1", {
      status: "resolved",
      action: "suspend",
    });
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { status: "suspended" },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it("leaves the profile untouched when action=none", async () => {
    const prisma = {
      safetyReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: "r1",
          reportedProfileId: "p2",
          reported: { userId: "u2" },
        }),
        update: jest.fn().mockResolvedValue({ id: "r1", status: "dismissed" }),
      },
      profile: { update: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    await makeService(prisma).resolveSafetyReport("r1", {
      status: "dismissed",
      action: "none",
    });
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it("reinstates a profile to active", async () => {
    const prisma = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({ id: "p2", status: "suspended" }),
        update: jest.fn().mockResolvedValue({ id: "p2", status: "active" }),
      },
    } as any;
    await makeService(prisma).reinstateProfile("p2");
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { status: "active" },
    });
  });

  it("throws when reinstating a missing profile", async () => {
    const prisma = { profile: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(makeService(prisma).reinstateProfile("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
