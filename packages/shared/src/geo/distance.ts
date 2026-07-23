/**
 * Geo helpers for radius-based matching. Pure functions (no deps) so backend, client, and tests
 * all share one implementation. Coordinates are WGS84 decimal degrees; distances are kilometres.
 */
export type Coords = { lat: number; lng: number };

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres between two lat/lng points (haversine). */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * True when two people are close enough to match. Distance is only enforced when BOTH have
 * coordinates; a null radius means "no limit". The effective limit is the SMALLER of the two
 * radii, so a pairing respects each person's tightest preference. Missing coords → always ok
 * (location is optional; no coords = match anyone).
 */
export function withinMutualRadius(
  a: { coords?: Coords | null; radiusKm?: number | null },
  b: { coords?: Coords | null; radiusKm?: number | null },
): boolean {
  if (!a.coords || !b.coords) return true;
  const limits = [a.radiusKm, b.radiusKm].filter(
    (r): r is number => typeof r === "number" && r > 0,
  );
  if (limits.length === 0) return true;
  return haversineKm(a.coords, b.coords) <= Math.min(...limits);
}
