import { apiFetch } from "./client";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role?: "user" | "admin" | "super_admin";
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

/** 관리자 콘솔 로그인 — 백엔드 ADMIN_EMAIL/ADMIN_PASSWORD_HASH 설정 시에만 동작(미설정=501). */
export function adminLogin(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

