/** Normalized (profileId1, profileId2) ordering for the Match @@unique — always ascending. */
export function normalizeMatchPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Order-independent key for a pair of profile ids (used for block lookups). */
export function blockPairKey(a: string, b: string): string {
  const [x, y] = normalizeMatchPair(a, b);
  return `${x}:${y}`;
}
