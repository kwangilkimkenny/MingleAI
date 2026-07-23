/**
 * Client feature flags — single source of truth for turning product surfaces on/off.
 *
 * `partyGame` gates the "AI 찾기" party game world (매칭 → 파티 → 게임). It is OFF while
 * the pixel map + character work is on hold; blind speed-date is the main path. Flip to
 * `true` to re-enable every entry point at once (home CTA, matching route guard). Nothing
 * about the party/among code or backend is removed — this only controls reachability.
 */
export const FEATURES = {
  partyGame: false,
} as const;
