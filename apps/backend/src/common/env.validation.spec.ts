import { validateEnvironment } from "./env.validation";

const productionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://mingle:secret@db.internal:5432/mingle",
  JWT_SECRET: "a-production-jwt-secret-longer-than-32-characters",
  PUBLIC_BASE_URL: "https://api.mingles.kr",
  SOCKET_CORS_ORIGINS: "https://app.mingles.kr,https://admin.mingles.kr",
  KAKAO_CLIENT_ID: "public-client-id",
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
  ])("rejects production configuration with %s", (_label, override) => {
    expect(() => validateEnvironment({ ...productionEnv, ...override })).toThrow();
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
