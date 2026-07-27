/**
 * Location seam (native) — foreground GPS via expo-location, loaded lazily with a guarded require
 * so the app builds/runs before the module is installed (mirrors the push/livekit lazy-import
 * seams). Location is an OPTIONAL permission requested at blind-date entry; when unavailable the
 * caller simply enqueues without coordinates (matches anyone). Web uses `location.web.ts`.
 */
export type Coords = { lat: number; lng: number };
export type LocationPermission = "granted" | "denied" | "undetermined";

/* eslint-disable @typescript-eslint/no-explicit-any */
function expoLocation(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-location");
  } catch {
    return null;
  }
}

function normalize(status: string): LocationPermission {
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export async function getLocationPermission(): Promise<LocationPermission> {
  const L = expoLocation();
  if (!L) return "undetermined";
  try {
    const { status } = await L.getForegroundPermissionsAsync();
    return normalize(status);
  } catch {
    return "undetermined";
  }
}

/** Prompt for foreground location, then return the current position when granted. */
export async function requestLocation(): Promise<{ status: LocationPermission; coords?: Coords }> {
  const L = expoLocation();
  if (!L) return { status: "undetermined" };
  try {
    const { status } = await L.requestForegroundPermissionsAsync();
    if (status !== "granted") return { status: normalize(status) };
    try {
      const pos = await L.getCurrentPositionAsync({});
      return { status: "granted", coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
    } catch {
      // 프로바이더가 아직 fix를 못 잡은 경우(에뮬레이터·실내) — 마지막 알려진 위치로 폴백.
      const last = await L.getLastKnownPositionAsync({});
      if (last) {
        return {
          status: "granted",
          coords: { lat: last.coords.latitude, lng: last.coords.longitude },
        };
      }
      return { status: "granted" };
    }
  } catch {
    return { status: "undetermined" };
  }
}

export async function getCurrentCoords(): Promise<Coords | null> {
  const L = expoLocation();
  if (!L) return null;
  try {
    const perm = await L.getForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const pos = await L.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
