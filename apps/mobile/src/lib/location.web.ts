/**
 * Location seam (web) — the browser Geolocation API (Metro picks `.web.ts` for the web bundle).
 * Same shape as `location.ts`. On web the browser handles the permission prompt; a denial or
 * timeout resolves to null coords so the caller enqueues without a location.
 */
export type Coords = { lat: number; lng: number };
export type LocationPermission = "granted" | "denied" | "undetermined";

function geo(): Geolocation | null {
  try {
    return globalThis.navigator?.geolocation ?? null;
  } catch {
    return null;
  }
}

function once(): Promise<Coords | null> {
  const g = geo();
  if (!g) return Promise.resolve(null);
  return new Promise((resolve) => {
    g.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

export async function getLocationPermission(): Promise<LocationPermission> {
  try {
    const perms = (globalThis.navigator as unknown as { permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> } })
      .permissions;
    const res = await perms?.query?.({ name: "geolocation" });
    if (res?.state === "granted") return "granted";
    if (res?.state === "denied") return "denied";
    return "undetermined";
  } catch {
    return "undetermined";
  }
}

export async function requestLocation(): Promise<{ status: LocationPermission; coords?: Coords }> {
  const coords = await once();
  return coords ? { status: "granted", coords } : { status: "denied" };
}

export async function getCurrentCoords(): Promise<Coords | null> {
  return once();
}
