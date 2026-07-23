import { describe, it, expect } from "vitest";
import { haversineKm, withinMutualRadius } from "./distance.js";

const seoul = { lat: 37.5665, lng: 126.978 };
const busan = { lat: 35.1796, lng: 129.0756 };

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(seoul, seoul)).toBeCloseTo(0, 5);
  });

  it("matches the known Seoul–Busan distance (~325km)", () => {
    expect(haversineKm(seoul, busan)).toBeGreaterThan(320);
    expect(haversineKm(seoul, busan)).toBeLessThan(330);
  });

  it("is symmetric", () => {
    expect(haversineKm(seoul, busan)).toBeCloseTo(haversineKm(busan, seoul), 6);
  });
});

describe("withinMutualRadius", () => {
  const near = { lat: 37.57, lng: 126.99 }; // ~1.5km from seoul

  it("allows when either party has no coords (location optional)", () => {
    expect(withinMutualRadius({ coords: null, radiusKm: 5 }, { coords: busan, radiusKm: 5 })).toBe(true);
    expect(withinMutualRadius({ coords: seoul, radiusKm: 5 }, { coords: null, radiusKm: 5 })).toBe(true);
  });

  it("allows when no radius set (no limit)", () => {
    expect(withinMutualRadius({ coords: seoul }, { coords: busan })).toBe(true);
    expect(withinMutualRadius({ coords: seoul, radiusKm: null }, { coords: busan, radiusKm: null })).toBe(true);
  });

  it("enforces the smaller radius", () => {
    // near is ~1.5km away: within a 5km radius, outside a 1km radius
    expect(withinMutualRadius({ coords: seoul, radiusKm: 5 }, { coords: near, radiusKm: 5 })).toBe(true);
    expect(withinMutualRadius({ coords: seoul, radiusKm: 5 }, { coords: near, radiusKm: 1 })).toBe(false);
    expect(withinMutualRadius({ coords: seoul, radiusKm: 1 }, { coords: near, radiusKm: 5 })).toBe(false);
  });

  it("rejects far pairs within a tight radius", () => {
    expect(withinMutualRadius({ coords: seoul, radiusKm: 50 }, { coords: busan, radiusKm: 50 })).toBe(false);
  });
});
