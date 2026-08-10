import { BadRequestException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { IdentityService } from "./identity.service";

const bypassConfig = { get: (k: string) => (k === "IDENTITY_DEV_BYPASS" ? "true" : undefined) } as any;
const offConfig = { get: () => undefined } as any;
const providerValues: Record<string, string> = {
  PORTONE_STORE_ID: "store-test",
  PORTONE_IDENTITY_CHANNEL_KEY: "channel-key-test",
  PORTONE_API_SECRET: "api-secret-for-tests",
  PORTONE_IDENTITY_STATE_SECRET: "state-secret-for-tests-that-is-long-enough",
};
const providerConfig = { get: (key: string) => providerValues[key] } as any;

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

describe("IdentityService (PortOne production flow)", () => {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    profile: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("returns a signed, user-bound provider request", async () => {
    const result = await new IdentityService(providerConfig, prisma).start("user-1");
    expect(result).toMatchObject({
      mode: "portone",
      storeId: "store-test",
      channelKey: "channel-key-test",
      identityVerificationId: expect.stringMatching(/^mingles\./),
    });
  });

  it("re-reads verified attributes from PortOne and persists them", async () => {
    const service = new IdentityService(providerConfig, prisma);
    const start = await service.start("user-1");
    if (start.mode !== "portone") throw new Error("expected provider mode");
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: start.identityVerificationId,
        status: "VERIFIED",
        verifiedCustomer: {
          ci: "verified-ci",
          di: "verified-di",
          name: "홍길동",
          birthDate: "1996-05-02",
          gender: "FEMALE",
          phoneNumber: "01012345678",
        },
      }),
    } as Response);

    await expect(service.completePortOne("user-1", start.identityVerificationId)).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(start.identityVerificationId)),
      expect.objectContaining({ headers: { Authorization: "PortOne api-secret-for-tests" } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          identityCi: "verified-ci",
          identityDi: "verified-di",
          verifiedGender: "female",
        }),
      }),
    );
  });

  it("rejects a request id that belongs to another account before calling PortOne", async () => {
    const service = new IdentityService(providerConfig, prisma);
    const start = await service.start("user-1");
    if (start.mode !== "portone") throw new Error("expected provider mode");
    const fetchSpy = jest.spyOn(global, "fetch");
    await expect(service.completePortOne("user-2", start.identityVerificationId)).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
