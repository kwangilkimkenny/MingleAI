import { BadRequestException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { IdentityService } from "./identity.service";

const bypassConfig = { get: (k: string) => (k === "IDENTITY_DEV_BYPASS" ? "true" : undefined) } as any;
const offConfig = { get: () => undefined } as any;

const payload = { name: "홍길동", birth: "1996-05-02", gender: "female" as const, phone: "01012345678" };

describe("IdentityService.complete (dev bypass)", () => {
  it("persists verified identity and reflects gender/age into the profile", async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      profile: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }), update: jest.fn().mockResolvedValue({}) },
    } as any;
    await new IdentityService(bypassConfig, prisma).complete("u1", payload);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ verifiedGender: "female", phoneVerifiedAt: expect.any(Date), identityCi: expect.any(String) }),
      }),
    );
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ gender: "female", age: expect.any(Number) }) }),
    );
  });

  it("rejects a duplicate identity (CI already on another account)", async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: "other" }), update: jest.fn() } } as any;
    await expect(new IdentityService(bypassConfig, prisma).complete("u1", payload)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("is disabled when dev bypass is off", async () => {
    const prisma = { user: {}, profile: {} } as any;
    await expect(new IdentityService(offConfig, prisma).complete("u1", payload)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("derives the same CI for the same phone (dev dup detection is deterministic)", async () => {
    const captured: string[] = [];
    const prisma = {
      user: {
        findFirst: jest.fn(async ({ where }: any) => {
          captured.push(where.identityCi);
          return null;
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      profile: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = new IdentityService(bypassConfig, prisma);
    await svc.complete("u1", payload);
    await svc.complete("u2", payload);
    expect(captured[0]).toBe(captured[1]);
  });
});

// PortOne 경로는 2026-08-12 삭제(키·계약 없이 실효 0, 보안 경로에 안 쓰는 분기를 두는 값이 더 컸다).
// 공급자는 NICE 하나이고 계약 대기 중이므로, 지금 운영에서 인증 시작은 명시적으로 막힌다.
describe("IdentityService (공급자 미구성)", () => {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    profile: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
  } as any;

  it("dev bypass가 꺼져 있으면 start가 503으로 막는다", async () => {
    const config = { get: () => undefined } as any;
    await expect(new IdentityService(config, prisma).start("user-1")).rejects.toThrow(
      "본인인증이 현재 구성되지 않았습니다",
    );
  });

  it("dev bypass가 꺼져 있으면 complete도 막는다(개발용 입력이 운영에 새지 않게)", async () => {
    const config = { get: () => undefined } as any;
    await expect(
      new IdentityService(config, prisma).complete("user-1", {
        name: "홍길동",
        birth: "1996-05-02",
        gender: "female",
        phone: "01012345678",
      }),
    ).rejects.toThrow("본인인증이 현재 구성되지 않았습니다");
  });
});
