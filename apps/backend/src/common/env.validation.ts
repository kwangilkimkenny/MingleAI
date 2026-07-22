import { z } from "zod";

const httpOrigin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.pathname === "/";
  }, "must be an HTTP(S) origin without a path");

export function validateEnvironment(raw: Record<string, unknown>): Record<string, unknown> {
  const common = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      DATABASE_URL: z.string().min(1),
      JWT_SECRET: z.string().min(16),
      PUBLIC_BASE_URL: z.string().url().optional(),
      SOCKET_CORS_ORIGINS: z.string().optional(),
    })
    .passthrough()
    .parse(raw);

  if (common.NODE_ENV !== "production") return common;

  const production = z
    .object({
      JWT_SECRET: z.string().min(32),
      PUBLIC_BASE_URL: httpOrigin,
      SOCKET_CORS_ORIGINS: z.string().min(1),
    })
    .parse(common);

  const origins = production.SOCKET_CORS_ORIGINS.split(",").map((value) => value.trim());
  if (origins.some((value) => !value || value === "*")) {
    throw new Error("SOCKET_CORS_ORIGINS must contain explicit origins in production");
  }
  for (const origin of origins) httpOrigin.parse(origin);

  return common;
}
