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

  const hasIdentityProvider =
    Boolean(common.PORTONE_STORE_ID) &&
    Boolean(common.PORTONE_IDENTITY_CHANNEL_KEY) &&
    Boolean(common.PORTONE_API_SECRET) &&
    Boolean(common.PORTONE_IDENTITY_STATE_SECRET);
  if (!hasIdentityProvider) {
    throw new Error("PortOne identity verification must be fully configured in production");
  }

  return common;
}
