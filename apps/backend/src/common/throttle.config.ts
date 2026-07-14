export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

function intOr(raw: string | undefined, def: number, { min = 1 } = {}): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : def;
}

/**
 * Global rate-limit tuning, env-driven with validated defaults (mirrors `party/among.config.ts`
 * house style). Pure function so it's testable without a Nest DI container.
 *
 * `RATE_LIMIT_TTL_MS` — window size in ms (default 60000, floor 1000).
 * `RATE_LIMIT_MAX` — max requests per window (default 120, floor 5).
 * Invalid/NaN/below-floor values fall back to the default.
 */
export function throttleConfig(env: NodeJS.ProcessEnv): ThrottleConfig {
  return {
    ttl: intOr(env.RATE_LIMIT_TTL_MS, 60000, { min: 1000 }),
    limit: intOr(env.RATE_LIMIT_MAX, 120, { min: 5 }),
  };
}
