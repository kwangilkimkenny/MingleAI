import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
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
    await new SocialAuthService(config(kakaoKeys), prisma, a).login("kakao", "code", "mingles://cb", "verifier");
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

  it("maps an invalid authorization grant to 401 instead of a server error", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    }) as any;
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "expired", "cb"),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("maps a provider outage to 502", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "temporarily_unavailable" }),
    }) as any;
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "code", "cb"),
    ).rejects.toThrow(BadGatewayException);
  });

  it.each([
    [401, UnauthorizedException],
    [403, BadGatewayException],
    [503, BadGatewayException],
  ])("maps a user-info %s response without touching the database", async (status, ErrorType) => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "at" }) })
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({}) }) as any;
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "code", "cb"),
    ).rejects.toThrow(ErrorType);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("does not misreport an invalid provider client configuration as a user 401", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_client" }),
    }) as any;
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "code", "cb"),
    ).rejects.toThrow(BadGatewayException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["network rejection", () => Promise.reject(new TypeError("connection reset"))],
    ["malformed JSON", () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError("bad json"); } })],
  ])("maps a provider %s to 502", async (_label, response) => {
    global.fetch = jest.fn().mockImplementationOnce(response) as any;
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "code", "cb"),
    ).rejects.toThrow(BadGatewayException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a successful provider response without a stable account id", async () => {
    mockFetch({ access_token: "at" }, { kakao_account: { email: "k@test.com" } });
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    await expect(
      new SocialAuthService(config(kakaoKeys), prisma, auth()).login("kakao", "code", "cb"),
    ).rejects.toThrow(BadGatewayException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("configuredProviders reflects which keys are present", () => {
    const svc = new SocialAuthService(config(kakaoKeys), { user: {} } as any, auth());
    expect(svc.configuredProviders()).toEqual(["kakao"]);
  });

  it("blocks new production accounts while NICE signup verification is unavailable", async () => {
    mockFetch({ access_token: "at" }, { id: 123 });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    } as any;
    const a = auth();
    await expect(
      new SocialAuthService(config({ ...kakaoKeys, NODE_ENV: "production" }), prisma, a).login(
        "kakao",
        "code",
        "cb",
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(a.issueSession).not.toHaveBeenCalled();
  });

  it("blocks an existing unverified production account", async () => {
    mockFetch({ access_token: "at" }, { id: 123 });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          email: null,
          role: "user",
          phoneVerifiedAt: null,
        }),
      },
    } as any;
    const a = auth();
    await expect(
      new SocialAuthService(config({ ...kakaoKeys, NODE_ENV: "production" }), prisma, a).login(
        "kakao",
        "code",
        "cb",
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(a.issueSession).not.toHaveBeenCalled();
  });

  it("allows an already verified production user to sign in", async () => {
    mockFetch({ access_token: "at" }, { id: 123 });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          email: null,
          role: "user",
          phoneVerifiedAt: new Date(),
        }),
      },
    } as any;
    const a = auth();
    await new SocialAuthService(config({ ...kakaoKeys, NODE_ENV: "production" }), prisma, a).login(
      "kakao",
      "code",
      "cb",
    );
    expect(a.issueSession).toHaveBeenCalledWith("u1", null, "user");
  });
});
