import { validateEnvironment } from "./env.validation";

const productionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://mingle:secret@db.internal:5432/mingle",
  JWT_SECRET: "a-production-jwt-secret-longer-than-32-characters",
  PUBLIC_BASE_URL: "https://api.mingles.kr",
  SOCKET_CORS_ORIGINS: "https://app.mingles.kr,https://admin.mingles.kr",
  KAKAO_CLIENT_ID: "public-client-id",
  PORTONE_STORE_ID: "store-test",
  PORTONE_IDENTITY_CHANNEL_KEY: "channel-key-test",
  PORTONE_API_SECRET: "portone-api-secret-at-least-twenty-characters",
  PORTONE_IDENTITY_STATE_SECRET: "portone-state-secret-at-least-thirty-two-characters",
};

describe("validateEnvironment", () => {
  it("accepts a complete production configuration", () => {
    expect(validateEnvironment(productionEnv)).toMatchObject(productionEnv);
  });

  it("allows development configuration without production-only values", () => {
    expect(
      validateEnvironment({
        DATABASE_URL: "postgresql://localhost/mingle",
        JWT_SECRET: "development-secret",
      }),
    ).toMatchObject({ NODE_ENV: "development" });
  });

  it.each([
    ["short JWT", { JWT_SECRET: "too-short" }],
    ["missing public URL", { PUBLIC_BASE_URL: undefined }],
    ["cleartext public URL", { PUBLIC_BASE_URL: "http://api.mingles.kr" }],
    ["public URL with path", { PUBLIC_BASE_URL: "https://api.mingles.kr/v1" }],
    ["wildcard CORS", { SOCKET_CORS_ORIGINS: "*" }],
    ["cleartext CORS", { SOCKET_CORS_ORIGINS: "http://app.mingles.kr" }],
    ["dev login", { DEV_AUTH_ENABLED: "true" }],
    ["identity bypass", { IDENTITY_DEV_BYPASS: "true" }],
    ["missing PortOne store", { PORTONE_STORE_ID: undefined }],
    ["missing PortOne channel", { PORTONE_IDENTITY_CHANNEL_KEY: undefined }],
    ["missing PortOne API secret", { PORTONE_API_SECRET: undefined }],
    ["missing PortOne state secret", { PORTONE_IDENTITY_STATE_SECRET: undefined }],
  ])("rejects production configuration with %s", (_label, override) => {
    expect(() => validateEnvironment({ ...productionEnv, ...override })).toThrow();
  });

  // 2026-08-11: 공급자는 하나만 완비되면 된다(PortOne 또는 NICE). 예전엔 PortOne 4개를 강제해
  // NICE로 갈아타는 순간 운영 부팅이 막혔다.
  it("accepts NICE alone as the identity provider", () => {
    const {
      PORTONE_STORE_ID: _a,
      PORTONE_IDENTITY_CHANNEL_KEY: _b,
      PORTONE_API_SECRET: _c,
      PORTONE_IDENTITY_STATE_SECRET: _d,
      ...withoutPortOne
    } = productionEnv;
    expect(() =>
      validateEnvironment({
        ...withoutPortOne,
        NICE_CLIENT_ID: "nice-client",
        NICE_CLIENT_SECRET: "nice-secret",
        NICE_PRODUCT_ID: "2101979031",
        NICE_RETURN_URL: "https://api.mingles.kr/auth/identity/nice/callback",
      }),
    ).not.toThrow();
  });

  it("rejects a half-configured NICE setup (no provider is fully usable)", () => {
    const {
      PORTONE_STORE_ID: _a,
      PORTONE_IDENTITY_CHANNEL_KEY: _b,
      PORTONE_API_SECRET: _c,
      PORTONE_IDENTITY_STATE_SECRET: _d,
      ...withoutPortOne
    } = productionEnv;
    expect(() =>
      validateEnvironment({ ...withoutPortOne, NICE_CLIENT_ID: "nice-client" }),
    ).toThrow();
  });

  it("rejects a cleartext NICE return URL", () => {
    expect(() =>
      validateEnvironment({
        ...productionEnv,
        NICE_RETURN_URL: "http://api.mingles.kr/auth/identity/nice/callback",
      }),
    ).toThrow();
  });

  it("requires at least one usable social login provider", () => {
    expect(() =>
      validateEnvironment({
        ...productionEnv,
        KAKAO_CLIENT_ID: undefined,
        GOOGLE_CLIENT_ID: undefined,
        NAVER_CLIENT_ID: "naver-id-without-secret",
      }),
    ).toThrow("At least one social login provider");
  });

  it("accepts Naver only when both credentials are configured", () => {
    expect(
      validateEnvironment({
        ...productionEnv,
        KAKAO_CLIENT_ID: undefined,
        NAVER_CLIENT_ID: "naver-client-id",
        NAVER_CLIENT_SECRET: "naver-client-secret",
      }),
    ).toMatchObject({ NAVER_CLIENT_ID: "naver-client-id" });
  });
});
