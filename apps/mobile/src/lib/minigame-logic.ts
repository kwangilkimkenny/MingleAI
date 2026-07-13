/**
 * Pure, side-effect-free helpers for the Among Us task minigames.
 * Extracted so they can be unit-tested without React Native.
 */

/**
 * Returns true iff every left node `i` has a link defined AND the symbols match.
 * `links` is a map of left-index → right-index.
 */
export function wiresSolved(
  leftSymbols: string[],
  rightSymbols: string[],
  links: Record<number, number>,
): boolean {
  if (leftSymbols.length === 0) return false;
  for (let i = 0; i < leftSymbols.length; i++) {
    const rightIdx = links[i];
    if (rightIdx === undefined) return false;
    if (leftSymbols[i] !== rightSymbols[rightIdx]) return false;
  }
  return true;
}

/**
 * Advance the sequence game state by one tap.
 * - Correct tap at `max` → `{ expected, done: true }`.
 * - Correct tap otherwise → `{ expected: expected + 1, done: false }`.
 * - Wrong tap → `{ expected: 1, done: false }` (reset to beginning).
 */
export function sequenceStep(
  expected: number,
  tapped: number,
  max: number,
): { expected: number; done: boolean } {
  if (tapped !== expected) {
    return { expected: 1, done: false };
  }
  if (expected === max) {
    return { expected, done: true };
  }
  return { expected: expected + 1, done: false };
}

/**
 * Returns true iff `pos` (0..1) is within the inclusive target zone [lo, hi].
 */
export function inTargetZone(pos: number, lo = 0.4, hi = 0.6): boolean {
  return pos >= lo && pos <= hi;
}
