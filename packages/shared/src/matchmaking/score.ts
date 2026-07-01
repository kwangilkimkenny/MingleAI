import type { PreferenceSignals } from "../types/preference.js";

export interface ScoreWeights {
  vibe: number;
  drinking: number;
  pace: number;
  activity: number;
  tags: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  vibe: 3,
  drinking: 2,
  pace: 2,
  activity: 1,
  tags: 1,
};

const OVERLAP_CAP = 3;

function overlapCount(x?: string[], y?: string[]): number {
  const a = new Set(x ?? []);
  let n = 0;
  for (const t of new Set(y ?? [])) if (a.has(t)) n++;
  return n;
}

/** Normalized preference similarity in [0, 1]. Deterministic, no I/O. */
export function preferenceScore(
  a: PreferenceSignals,
  b: PreferenceSignals,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  let raw = 0;
  if (a.vibe === b.vibe) raw += weights.vibe;
  if (a.drinking === b.drinking) raw += weights.drinking;
  if (a.pace === b.pace) raw += weights.pace;
  raw += weights.activity * Math.min(overlapCount(a.activity, b.activity), OVERLAP_CAP);
  raw += weights.tags * Math.min(overlapCount(a.tags, b.tags), OVERLAP_CAP);

  const max =
    weights.vibe +
    weights.drinking +
    weights.pace +
    weights.activity * OVERLAP_CAP +
    weights.tags * OVERLAP_CAP;
  return max === 0 ? 0 : raw / max;
}
