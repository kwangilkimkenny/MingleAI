import { UnauthorizedException } from "@nestjs/common";
import { AccountAccessService } from "./account-access.service";

// Regression: ISSUE-003 — account suspension and deletion paths lacked direct access-gate tests
// Found by /qa on 2026-08-07
// Report: .gstack/qa-reports/release-readiness-qa-2026-08-07.md
describe("AccountAccessService", () => {
  function service(user: unknown) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } } as any;
    return { service: new AccountAccessService(prisma), prisma };
  }

  it("returns the minimal active account projection", async () => {
    const { service: access, prisma } = service({
      id: "u1",
      email: "user@example.com",
      role: "user",
      profile: { status: "active" },
    });

    await expect(access.findActive("u1")).resolves.toEqual({
      userId: "u1",
      email: "user@example.com",
      role: "user",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });

  it("allows an account before profile creation and normalizes a null email", async () => {
    const { service: access } = service({ id: "u1", email: null, role: "user", profile: null });
    await expect(access.findActive("u1")).resolves.toEqual({
      userId: "u1",
      email: "",
      role: "user",
    });
  });

  it.each([null, { id: "u1", profile: { status: "suspended" } }, { id: "u1", profile: { status: "deleted" } }])(
    "rejects missing or inactive account %#",
    async (user) => {
      const { service: access } = service(user);
      await expect(access.findActive("u1")).resolves.toBeNull();
    },
  );

  it("requireActive throws a stable unauthorized error for an inactive account", async () => {
    const { service: access } = service({ id: "u1", profile: { status: "suspended" } });
    await expect(access.requireActive("u1")).rejects.toEqual(
      new UnauthorizedException("사용할 수 없는 계정입니다"),
    );
  });
});
