import { BadRequestException } from "@nestjs/common";
import { ConsentService } from "./consent.service";

describe("ConsentService", () => {
  it("requires all mandatory scopes (terms+privacy; age19 is legacy, not required)", async () => {
    const prisma = { consentGrant: { upsert: jest.fn() }, user: { update: jest.fn() } } as any;
    await expect(new ConsentService(prisma).submit("u1", ["terms"] as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("upserts each granted scope and stamps legacy user columns", async () => {
    const prisma = {
      consentGrant: { upsert: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}) },
    } as any;
    await new ConsentService(prisma).submit("u1", ["terms", "privacy"]);
    expect(prisma.consentGrant.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ termsAcceptedAt: expect.any(Date) }) }),
    );
  });

  it("getAccountStatus reports gate readiness", async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ authProvider: "kakao", phoneVerifiedAt: new Date("2026-07-22T00:00:00Z"), profile: { id: "p1" } }),
      },
      consentGrant: { findMany: jest.fn().mockResolvedValue([{ scope: "terms" }, { scope: "privacy" }, { scope: "age19" }]) },
    } as any;
    const status = await new ConsentService(prisma).getAccountStatus("u1");
    expect(status).toEqual({
      provider: "kakao",
      phoneVerifiedAt: "2026-07-22T00:00:00.000Z",
      consents: { terms: true, privacy: true, age19: true },
      hasProfile: true,
    });
  });
});
