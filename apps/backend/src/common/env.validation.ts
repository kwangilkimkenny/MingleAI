import { z } from "zod";

const httpOrigin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.pathname === "/";
  }, "must be an HTTP(S) origin without a path");

const httpsOrigin = httpOrigin.refine(
  (value) => new URL(value).protocol === "https:",
  "must use HTTPS in production",
);

export function validateEnvironment(raw: Record<string, unknown>): Record<string, unknown> {
  const common = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      DATABASE_URL: z.string().min(1),
      JWT_SECRET: z.string().min(16),
      PUBLIC_BASE_URL: z.string().url().optional(),
      SOCKET_CORS_ORIGINS: z.string().optional(),
      KAKAO_CLIENT_ID: z.string().min(1).optional(),
      KAKAO_CLIENT_SECRET: z.string().min(1).optional(),
      NAVER_CLIENT_ID: z.string().min(1).optional(),
      NAVER_CLIENT_SECRET: z.string().min(1).optional(),
      GOOGLE_CLIENT_ID: z.string().min(1).optional(),
      GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
      // 인증 요청을 사용자에게 묶는 서명 키(공급자 무관).
      IDENTITY_STATE_SECRET: z.string().min(32).optional(),
      // NICE 직계약 경로(2026-08-10 결정). 코드는 nice.provider.ts에 자리만 있고 계약 대기 중이다.
      NICE_CLIENT_ID: z.string().min(1).optional(),
      NICE_CLIENT_SECRET: z.string().min(1).optional(),
      NICE_PRODUCT_ID: z.string().min(1).optional(),
      // 콜백은 origin이 아니라 **경로가 있는** URL이다(예: https://api.…/auth/identity/nice/callback).
      NICE_RETURN_URL: z
        .string()
        .url()
        .refine((v) => v.startsWith("https://"), "must be an HTTPS URL")
        .optional(),
    })
    .passthrough()
    .parse(raw);

  if (common.NODE_ENV !== "production") return common;

  const production = z
    .object({
      JWT_SECRET: z.string().min(32),
      PUBLIC_BASE_URL: httpsOrigin,
      SOCKET_CORS_ORIGINS: z.string().min(1),
    })
    .parse(common);

  const origins = production.SOCKET_CORS_ORIGINS.split(",").map((value) => value.trim());
  if (origins.some((value) => !value || value === "*")) {
    throw new Error("SOCKET_CORS_ORIGINS must contain explicit origins in production");
  }
  for (const origin of origins) httpsOrigin.parse(origin);

  const hasConfiguredSocialProvider =
    Boolean(common.KAKAO_CLIENT_ID) ||
    Boolean(common.GOOGLE_CLIENT_ID) ||
    Boolean(common.NAVER_CLIENT_ID && common.NAVER_CLIENT_SECRET);
  if (!hasConfiguredSocialProvider) {
    throw new Error("At least one social login provider must be configured in production");
  }

  // Dev-only auth bypasses must never be enabled in production.
  if (common.DEV_AUTH_ENABLED === "true")
    throw new Error("DEV_AUTH_ENABLED must not be true in production");
  if (common.IDENTITY_DEV_BYPASS === "true")
    throw new Error("IDENTITY_DEV_BYPASS must not be true in production");

  // 본인인증(NICE)이 없으면 운영에서 부팅하지 않는다. 나이·성별·1인1계정의 유일한 근거라
  // 이게 없으면 신고·차단·연령 제한이 전부 종이호랑이가 된다.
  const hasNice =
    Boolean(common.NICE_CLIENT_ID) &&
    Boolean(common.NICE_CLIENT_SECRET) &&
    Boolean(common.NICE_PRODUCT_ID) &&
    Boolean(common.NICE_RETURN_URL);
  if (!hasNice) {
    throw new Error("NICE identity verification must be fully configured in production");
  }

  return common;
}
