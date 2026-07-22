import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { SocialAuthService } from "./social-auth.service";

function config(keys: Record<string, string> = {}) {
  return { get: (k: string) => keys[k] } as any;
}
function auth() {
  return { issueSession: jest.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r", role: "user" }) } as any;
}
function mockFetch(token: any, userinfo: any) {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => token })
    .mockResolvedValueOnce({ ok: true, json: async () => userinfo }) as any;
}

const kakaoKeys = { KAKAO_CLIENT_ID: "kid", KAKAO_CLIENT_SECRET: "ksec" };

describe("SocialAuthService", () => {
  it("creates a new user keyed by (provider, providerId) and issues a session", async () => {
    mockFetch({ access_token: "at" }, { id: 123, kakao_account: { email: "k@test.com" } });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "u1", email: "k@test.com", role: "user" }) },
    } as any;
    const a = auth();
    await new SocialAuthService(config(kakaoKeys), prisma, a).login("kakao", "code", "mingleai://cb", "verifier");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authProvider: "kakao", providerId: "123", email: "k@test.com" }),
    });
    expect(a.issueSession).toHaveBeenCalled();
  });

  it("reuses an existing (provider, providerId) user", async () => {
    mockFetch({ access_token: "at" }, { id: 123, kakao_account: { email: "k@test.com" } });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: "u1", email: "k@test.com", role: "user" }), create: jest.fn() } } as any;
    await new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "c", "cb");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("drops a colliding email so two providers do not conflict", async () => {
    mockFetch({ access_token: "at" }, { id: 123, kakao_account: { email: "taken@test.com" } });
    const prisma = {
      user: {
        // compound lookup null, email lookup hits an existing user
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "other" }),
        create: jest.fn().mockResolvedValue({ id: "u1", email: null, role: "user" }),
      },
    } as any;
    await new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "c", "cb");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authProvider: "kakao", providerId: "123", email: null }),
    });
  });

  it("rejects an unconfigured provider with 503", async () => {
    const prisma = { user: {} } as any;
    await expect(
      new SocialAuthService(config(), prisma, auth()).login("naver", "c", "cb"),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("rejects an unsupported provider with 400", async () => {
    const prisma = { user: {} } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("apple", "c", "cb"),
    ).rejects.toThrow(BadRequestException);
  });

  it("configuredProviders reflects which keys are present", () => {
    const svc = new SocialAuthService(config(kakaoKeys), { user: {} } as any, auth());
    expect(svc.configuredProviders()).toEqual(["kakao"]);
  });
});
