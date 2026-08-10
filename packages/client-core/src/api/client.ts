import { getClientConfig, getToken } from "../config.js";

let refreshInFlight: Promise<string | null> | null = null;
const REQUEST_TIMEOUT_MS = 15_000;

async function refreshOnce(): Promise<string | null> {
  const refresh = getClientConfig().refreshAccessToken;
  if (!refresh) return null;
  refreshInFlight ??= refresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
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
  retried = false,
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const upstreamSignal = options?.signal;
  const abortFromUpstream = () => controller.abort();
  upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !upstreamSignal?.aborted) {
      throw new ApiError(408, "요청 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도해주세요.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }

  if (res.status === 401 && token) {
    if (!retried) {
      const nextToken = await refreshOnce().catch(() => null);
      if (nextToken) return apiFetch<T>(path, options, true);
    }
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
