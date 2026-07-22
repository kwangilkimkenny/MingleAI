/**
 * Round-robin pairing for the blind speed-date session.
 *
 * Fixes the male order and rotates the females so that across N rounds every male
 * meets every female exactly once. Returns `schedule[round][pair] = [maleId, femaleId]`.
 * Both groups must be the same size (the mode is a fixed 3×3, but this is size-agnostic).
 */
export function buildRotationSchedule(males: string[], females: string[]): [string, string][][] {
  if (males.length !== females.length) {
    throw new Error("buildRotationSchedule: male and female groups must be equal size");
  }
  const n = males.length;
  const schedule: [string, string][][] = [];
  for (let r = 0; r < n; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n; i++) {
      round.push([males[i], females[(i + r) % n]]);
    }
    schedule.push(round);
  }
  return schedule;
}
