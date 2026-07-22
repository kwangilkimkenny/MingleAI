/**
 * Socket.IO CORS `origin` config, env-driven for production hardening.
 *
 * `SOCKET_CORS_ORIGINS` — comma-separated allowlist of origins (e.g.
 * "https://app.mingle.example,https://admin.mingle.example"). When unset/empty the gateways
 * reflect any origin (`true`) — the dev default, unchanged from before. Set it in prod to lock
 * the WebSocket handshake to known origins.
 *
 * Evaluated at module load because @WebSocketGateway decorator options are static (no DI), so the
 * env var must be present at process start.
 */
export function socketCorsOrigin(
  raw: string | undefined = process.env.SOCKET_CORS_ORIGINS,
): boolean | string[] {
  const trimmed = raw?.trim();
  if (!trimmed) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SOCKET_CORS_ORIGINS is required in production");
    }
    return true;
  }
  const allow = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && allow.some((origin) => origin === "*")) {
    throw new Error("Wildcard CORS origins are forbidden in production");
  }
  return allow.length > 0 ? allow : true;
}
