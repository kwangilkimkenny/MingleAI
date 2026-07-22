import { ForbiddenException } from "@nestjs/common";
import { VerifiedGuard } from "./verified.guard";

function ctx(userId?: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ user: userId ? { userId } : undefined }) }) } as any;
}

describe("VerifiedGuard", () => {
  it("allows a verified user with privacy consent", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ phoneVerifiedAt: new Date() }) },
      consentGrant: { findUnique: jest.fn().mockResolvedValue({ id: "c1" }) },
    } as any;
    expect(await new VerifiedGuard(prisma).canActivate(ctx("u1"))).toBe(true);
  });

  it("blocks an unverified user", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ phoneVerifiedAt: null }) },
      consentGrant: { findUnique: jest.fn() },
    } as any;
    await expect(new VerifiedGuard(prisma).canActivate(ctx("u1"))).rejects.toThrow(ForbiddenException);
  });

  it("blocks a verified user without privacy consent", async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ phoneVerifiedAt: new Date() }) },
      consentGrant: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    await expect(new VerifiedGuard(prisma).canActivate(ctx("u1"))).rejects.toThrow(ForbiddenException);
  });

  it("blocks when there is no authenticated user", async () => {
    await expect(new VerifiedGuard({} as any).canActivate(ctx())).rejects.toThrow(ForbiddenException);
  });
});
