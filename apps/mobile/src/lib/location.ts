/**
 * Location seam (native) — foreground GPS via expo-location, loaded lazily with a guarded require
 * so the app builds/runs before the module is installed (mirrors the push/livekit lazy-import
 * seams). Location is an OPTIONAL permission requested at blind-date entry; when unavailable the
 * caller simply enqueues without coordinates (matches anyone). Web uses `location.web.ts`.
 */
export type Coords = { lat: number; lng: number };
export type LocationPermission = "granted" | "denied" | "undetermined";

/** getCurrentPositionAsync는 fix가 없으면 무한 대기할 수 있다(실내·에뮬레이터) — 상한을 둔다. */
const FIX_TIMEOUT_MS = 7000;

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

/** 제한 시간 안에 안 오면 reject — 호출부는 lastKnown 폴백으로 넘어간다. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("location timeout")), ms)),
  ]);
}

/** 현재 좌표: 실시간 fix → (실패/지연 시) 마지막 알려진 위치 → null. */
type NativePosition = { coords: { latitude: number; longitude: number } } | null;

async function resolveCoords(L: any): Promise<Coords | null> {
  try {
    const pos = await withTimeout<NativePosition>(L.getCurrentPositionAsync({}), FIX_TIMEOUT_MS);
    if (pos) return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // fall through to the last known position
  }
  try {
    const last = await withTimeout<NativePosition>(L.getLastKnownPositionAsync({}), 2000);
    return last ? { lat: last.coords.latitude, lng: last.coords.longitude } : null;
  } catch {
    return null;
  }
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
    // Android's approximate grant is still a foreground "granted" permission. Asking again
    // immediately opens an unwanted precise-location upgrade dialog, so only prompt when the
    // user has not made a choice yet.
    const existing = await L.getForegroundPermissionsAsync();
    const { status } =
      existing.status === "granted"
        ? existing
        : await L.requestForegroundPermissionsAsync();
    if (status !== "granted") return { status: normalize(status) };
    const coords = await resolveCoords(L);
    return coords ? { status: "granted", coords } : { status: "granted" };
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
    return await resolveCoords(L);
  } catch {
    return null;
  }
}
