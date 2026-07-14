/**
 * Pure doodle-path generators for the hand-drawn (wobble) border system.
 * feTurbulence is unsupported in react-native-svg on native, so the "wobble" is a
 * pre-computed jittered path: straight edges become short segments whose vertices are
 * displaced by a seeded PRNG, corners stay quadratic curves. Deterministic per seed so
 * a surface never "boils" across re-renders.
 */

export type WonkyRadius = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/** mulberry32 — tiny deterministic PRNG, returns floats in [0, 1). */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function edgePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  step: number,
  amp: number,
  rand: () => number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.round(len / step));
  // Perpendicular unit vector for jitter displacement.
  const px = len === 0 ? 0 : -dy / len;
  const py = len === 0 ? 0 : dx / len;
  let d = "";
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const j = (rand() * 2 - 1) * amp;
    d += ` L${(x1 + dx * t + px * j).toFixed(2)} ${(y1 + dy * t + py * j).toFixed(2)}`;
  }
  return d + ` L${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Closed hand-drawn rounded-rect path: jittered edges + quadratic corners. */
export function wobbleRect(
  w: number,
  h: number,
  radius: WonkyRadius,
  seed: number,
  opts?: { amp?: number; step?: number },
): string {
  const amp = opts?.amp ?? 1.6;
  const step = opts?.step ?? 14;
  const rand = mulberry(seed);
  // Clamp radii so tiny boxes stay valid (mirrors CSS border-radius overlap rules).
  const s = Math.min(
    1,
    w / 2 / Math.max(radius.borderTopLeftRadius, radius.borderBottomLeftRadius, 1),
    h / 2 / Math.max(radius.borderTopLeftRadius, radius.borderTopRightRadius, 1),
  );
  const tl = radius.borderTopLeftRadius * s;
  const tr = radius.borderTopRightRadius * s;
  const br = radius.borderBottomRightRadius * s;
  const bl = radius.borderBottomLeftRadius * s;
  let d = `M${tl.toFixed(2)} 0`;
  d += edgePoints(tl, 0, w - tr, 0, step, amp, rand);
  d += ` Q${w.toFixed(2)} 0 ${w.toFixed(2)} ${tr.toFixed(2)}`;
  d += edgePoints(w, tr, w, h - br, step, amp, rand);
  d += ` Q${w.toFixed(2)} ${h.toFixed(2)} ${(w - br).toFixed(2)} ${h.toFixed(2)}`;
  d += edgePoints(w - br, h, bl, h, step, amp, rand);
  d += ` Q0 ${h.toFixed(2)} 0 ${(h - bl).toFixed(2)}`;
  d += edgePoints(0, h - bl, 0, tl, step, amp, rand);
  d += ` Q0 0 ${tl.toFixed(2)} 0 Z`;
  return d;
}

/** 45° hatch line segments clipped to a w×h box — the B&W "marker fill". */
export function hatchSegments(
  w: number,
  h: number,
  spacing = 5.5,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  if (w <= 0 || h <= 0) return [];
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  // Lines of slope -1 (45°): x + y = c, c from 0..w+h.
  for (let c = spacing; c < w + h; c += spacing) {
    const x1 = Math.max(0, c - h);
    const y1 = Math.min(h, c);
    const x2 = Math.min(w, c);
    const y2 = Math.max(0, c - w);
    segs.push({ x1, y1, x2, y2 });
  }
  return segs;
}
