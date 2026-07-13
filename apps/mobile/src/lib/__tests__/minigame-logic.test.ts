import { describe, it, expect } from "vitest";
import { wiresSolved, sequenceStep, inTargetZone } from "../minigame-logic";

// ── wiresSolved ───────────────────────────────────────────────────────────────

describe("wiresSolved", () => {
  const left = ["★", "●", "▲", "■"];
  const right = ["■", "▲", "★", "●"]; // shuffled

  it("returns true when all left→right links are correct", () => {
    // left[0]="★" → right[2]="★", left[1]="●"→right[3]="●",
    // left[2]="▲"→right[1]="▲", left[3]="■"→right[0]="■"
    const links = { 0: 2, 1: 3, 2: 1, 3: 0 };
    expect(wiresSolved(left, right, links)).toBe(true);
  });

  it("returns false when a link is missing", () => {
    const links = { 0: 2, 1: 3, 2: 1 }; // index 3 absent
    expect(wiresSolved(left, right, links)).toBe(false);
  });

  it("returns false when a link points to a mismatched symbol", () => {
    // left[0]="★" linked to right[0]="■" — mismatch
    const links = { 0: 0, 1: 3, 2: 1, 3: 2 };
    expect(wiresSolved(left, right, links)).toBe(false);
  });

  it("returns false for an empty links object", () => {
    expect(wiresSolved(left, right, {})).toBe(false);
  });

  it("returns false for empty symbol arrays", () => {
    expect(wiresSolved([], [], {})).toBe(false);
  });

  it("works for a single-element perfect match", () => {
    expect(wiresSolved(["★"], ["★"], { 0: 0 })).toBe(true);
  });

  it("works for a single-element mismatch", () => {
    expect(wiresSolved(["★"], ["●"], { 0: 0 })).toBe(false);
  });
});

// ── sequenceStep ──────────────────────────────────────────────────────────────

describe("sequenceStep", () => {
  it("advances expected on a correct tap (not yet at max)", () => {
    expect(sequenceStep(1, 1, 6)).toEqual({ expected: 2, done: false });
    expect(sequenceStep(3, 3, 6)).toEqual({ expected: 4, done: false });
  });

  it("completes when tapping the max value in order", () => {
    expect(sequenceStep(6, 6, 6)).toEqual({ expected: 6, done: true });
  });

  it("resets to 1 on a wrong tap", () => {
    expect(sequenceStep(1, 3, 6)).toEqual({ expected: 1, done: false });
    expect(sequenceStep(4, 2, 6)).toEqual({ expected: 1, done: false });
  });

  it("resets to 1 even when tapping max out-of-order", () => {
    expect(sequenceStep(3, 6, 6)).toEqual({ expected: 1, done: false });
  });

  it("does not complete if max is tapped before reaching it in sequence", () => {
    const result = sequenceStep(1, 6, 6);
    expect(result.done).toBe(false);
    expect(result.expected).toBe(1);
  });
});

// ── inTargetZone ──────────────────────────────────────────────────────────────

describe("inTargetZone", () => {
  it("returns true for a value inside the default zone", () => {
    expect(inTargetZone(0.5)).toBe(true);
    expect(inTargetZone(0.45)).toBe(true);
  });

  it("returns true at the inclusive lower boundary", () => {
    expect(inTargetZone(0.4)).toBe(true);
  });

  it("returns true at the inclusive upper boundary", () => {
    expect(inTargetZone(0.6)).toBe(true);
  });

  it("returns false just below the lower boundary", () => {
    expect(inTargetZone(0.399)).toBe(false);
  });

  it("returns false just above the upper boundary", () => {
    expect(inTargetZone(0.601)).toBe(false);
  });

  it("respects custom lo/hi parameters", () => {
    expect(inTargetZone(0.3, 0.2, 0.4)).toBe(true);
    expect(inTargetZone(0.5, 0.2, 0.4)).toBe(false);
  });

  it("returns false at 0 with default zone", () => {
    expect(inTargetZone(0)).toBe(false);
  });

  it("returns false at 1 with default zone", () => {
    expect(inTargetZone(1)).toBe(false);
  });
});
