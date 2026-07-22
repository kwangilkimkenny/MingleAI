import { useAuthStore } from "@/lib/store/auth";

let refreshPromise: Promise<string | null> | null = null;

async function refreshRequest(refreshToken: string) {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) throw new Error("refresh failed");
  return response.json() as Promise<{
    accessToken: string;
    refreshToken: string;
    role?: "user" | "admin" | "super_admin";
  }>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  retry = true,
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && token && retry) {
    const storedRefreshToken = useAuthStore.getState().refreshToken;
    if (storedRefreshToken) {
      refreshPromise ??= refreshRequest(storedRefreshToken)
        .then((session) => {
          useAuthStore.getState().setAuth({
            token: session.accessToken,
            refreshToken: session.refreshToken,
            role: session.role,
          });
          return session.accessToken;
        })
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });
      if (await refreshPromise) return apiFetch<T>(path, options, false);
    }
    useAuthStore.getState().logout();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "인증이 만료되었습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.message || `요청 실패 (${res.status})`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
