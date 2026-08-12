import { ForbiddenException } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";

function ctxWith(user: unknown) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("allows admins", () => {
    expect(guard.canActivate(ctxWith({ role: "admin" }))).toBe(true);
  });

  it("allows super_admins", () => {
    expect(guard.canActivate(ctxWith({ role: "super_admin" }))).toBe(true);
  });

  it("rejects non-admin roles with 403", () => {
    expect(() => guard.canActivate(ctxWith({ role: "user" }))).toThrow(ForbiddenException);
  });

  it("rejects unauthenticated requests with 403", () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ForbiddenException);
  });
});
