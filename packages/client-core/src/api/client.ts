import { getClientConfig, getToken } from "../config.js";

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
): Promise<T> {
  const { baseUrl, onUnauthorized } = getClientConfig();
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    onUnauthorized?.();
    throw new ApiError(401, "인증이 만료되었습니다.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const rawMessage = Array.isArray(body.message)
      ? body.message.join("\n")
      : body.message;
    throw new ApiError(res.status, rawMessage || `요청 실패 (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json().catch(() => undefined as T);
}
