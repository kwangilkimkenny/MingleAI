import type { AccountStatus, ConsentScope } from "@mingle/shared";
import { apiFetch, ApiError } from "./client.js";
import { getClientConfig } from "../config.js";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role?: "user" | "admin" | "super_admin";
}

export interface IdentityPayload {
  name: string;
  birth: string; // YYYY-MM-DD
  gender: "male" | "female";
  phone: string;
}

/** 공급자는 NICE 하나다(2026-08-12 PortOne 경로 삭제). nice 갈래는 계약 후 구현된다. */
export type IdentityVerificationStart = { mode: "dev" };

/** Which social providers are usable (keys configured server-side) — used to show buttons. */
export function getSocialProviders(): Promise<{ providers: string[] }> {
  return apiFetch<{ providers: string[] }>("/auth/social/providers");
}

/** Exchange a provider authorization code for a session. */
export function socialLogin(
  provider: "kakao" | "naver" | "google",
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/social", {
    method: "POST",
    body: JSON.stringify({ provider, code, redirectUri, codeVerifier }),
  });
}

/** Dev/CI/admin login (server rejects with 404 unless DEV_AUTH_ENABLED). */
export function devLogin(email: string, role?: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

/** Onboarding gate status (consents, phone verification, profile). */
export function getAccountStatus(): Promise<AccountStatus> {
  return apiFetch<AccountStatus>("/auth/account-status");
}

export function submitConsents(scopes: ConsentScope[]): Promise<void> {
  return apiFetch<void>("/auth/consent", { method: "POST", body: JSON.stringify({ scopes }) });
}

export function startIdentityVerification(): Promise<IdentityVerificationStart> {
  return apiFetch("/auth/identity/start", { method: "POST" });
}

export function completeIdentityVerification(payload: IdentityPayload): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/auth/identity/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Raw request avoids a refresh recursion when the access token has expired. */
export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const res = await fetch(`${getClientConfig().baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new ApiError(res.status, message ?? "세션을 갱신하지 못했습니다");
  }
  return res.json() as Promise<AuthResponse>;
}

export function logoutSession(refreshToken: string): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

/** Social-only accounts have no password — only the typed confirmation is required. */
export function deleteAccount(): Promise<void> {
  return apiFetch<void>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
}
