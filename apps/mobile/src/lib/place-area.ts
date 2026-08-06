/**
 * 맛집 탭이 기준으로 삼는 "지정 위치" — 현위치가 아니라 사용자가 고른 동네다(2026-08-06 지시).
 * 앱을 껐다 켜도 유지되도록 저장하고, 저장소가 없는 환경(웹 프리뷰)에서는 조용히 메모리만 쓴다.
 */
export type PlaceArea = { label: string; lat: number; lng: number };

const KEY = "mingles.place-area";

/** 저장소는 네이티브 모듈(expo-secure-store)에 붙어 있어 지연 로드한다 —
 *  순수 로직(parseArea)을 노드 테스트에서 그대로 부를 수 있도록. */
async function storage() {
  const mod = await import("./secure-storage");
  return mod.secureStorage;
}

let cache: PlaceArea | null = null;

/** 저장된 지정 위치. 없으면 null(호출부가 현위치로 폴백). */
export async function loadPlaceArea(): Promise<PlaceArea | null> {
  if (cache) return cache;
  const raw = await (await storage()).getItem(KEY);
  if (!raw) return null;
  const parsed = parseArea(raw);
  cache = parsed;
  return parsed;
}

export async function savePlaceArea(area: PlaceArea): Promise<void> {
  cache = area;
  await (await storage()).setItem(KEY, JSON.stringify(area));
}

export async function clearPlaceArea(): Promise<void> {
  cache = null;
  await (await storage()).removeItem(KEY);
}

/** 저장 문자열 → 위치. 형식이 깨졌으면 null(다음 저장 때 덮어쓴다). */
export function parseArea(raw: string): PlaceArea | null {
  try {
    const v = JSON.parse(raw) as Partial<PlaceArea>;
    if (typeof v?.label !== "string" || !v.label.trim()) return null;
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
    return { label: v.label, lat: v.lat as number, lng: v.lng as number };
  } catch {
    return null;
  }
}
