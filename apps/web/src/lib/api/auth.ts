import { apiFetch } from "./client";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role?: "user" | "admin" | "super_admin";
}

export function register(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, legalAccepted: true }),
  });
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) throw new Error("세션을 갱신하지 못했습니다.");
  return response.json() as Promise<AuthResponse>;
}

export function deleteAccount(password: string) {
  return apiFetch<void>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password, confirmation: "DELETE" }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
