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
      PORTONE_STORE_ID: z.string().min(1).optional(),
      PORTONE_IDENTITY_CHANNEL_KEY: z.string().min(1).optional(),
      PORTONE_API_SECRET: z.string().min(20).optional(),
      PORTONE_IDENTITY_STATE_SECRET: z.string().min(32).optional(),
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

  // 본인인증 공급자는 **하나만** 완비되면 된다 — PortOne이든 NICE든. 예전엔 PortOne 4개 키를
  // 강제해서, NICE로 가기로 한 뒤에는 운영 부팅 자체가 막혔다(2026-08-11).
  const hasPortOne =
    Boolean(common.PORTONE_STORE_ID) &&
    Boolean(common.PORTONE_IDENTITY_CHANNEL_KEY) &&
    Boolean(common.PORTONE_API_SECRET) &&
    Boolean(common.PORTONE_IDENTITY_STATE_SECRET);
  const hasNice =
    Boolean(common.NICE_CLIENT_ID) &&
    Boolean(common.NICE_CLIENT_SECRET) &&
    Boolean(common.NICE_PRODUCT_ID) &&
    Boolean(common.NICE_RETURN_URL);
  if (!hasPortOne && !hasNice) {
    throw new Error(
      "An identity verification provider must be fully configured in production (PortOne or NICE)",
    );
  }

  return common;
}
