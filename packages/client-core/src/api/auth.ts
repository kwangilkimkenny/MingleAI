import { apiFetch, ApiError } from "./client.js";
import { getClientConfig } from "../config.js";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role?: "user" | "admin" | "super_admin";
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, legalAccepted: true }),
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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

export function deleteAccount(password: string): Promise<void> {
  return apiFetch<void>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password, confirmation: "DELETE" }),
  });
}
