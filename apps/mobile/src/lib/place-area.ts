/**
 * 맛집 탭이 기준으로 삼는 "지정 위치" — 현위치가 아니라 사용자가 고른 동네다(2026-08-06 지시).
 * 앱을 껐다 켜도 유지되도록 저장하고, 저장소가 없는 환경(웹 프리뷰)에서는 조용히 메모리만 쓴다.
 */
export type PlaceArea = { label: string; lat: number; lng: number };

/** 용도별 저장 키 — 맛집 탭이 보는 동네와 데이트 약속 장소는 다를 수 있다. */
export type AreaScope = "places" | "date";

const KEYS: Record<AreaScope, string> = {
  places: "mingles.place-area",
  date: "mingles.date-area",
};

/** 저장소는 네이티브 모듈(expo-secure-store)에 붙어 있어 지연 로드한다 —
 *  순수 로직(parseArea)을 노드 테스트에서 그대로 부를 수 있도록. */
async function storage() {
  const mod = await import("./secure-storage");
  return mod.secureStorage;
}

const cache = new Map<AreaScope, PlaceArea>();

/** 저장된 지정 위치. 없으면 null(호출부가 현위치로 폴백). */
export async function loadPlaceArea(scope: AreaScope = "places"): Promise<PlaceArea | null> {
  const hit = cache.get(scope);
  if (hit) return hit;
  const raw = await (await storage()).getItem(KEYS[scope]);
  if (!raw) return null;
  const parsed = parseArea(raw);
  if (parsed) cache.set(scope, parsed);
  return parsed;
}

export async function savePlaceArea(area: PlaceArea, scope: AreaScope = "places"): Promise<void> {
  cache.set(scope, area);
  await (await storage()).setItem(KEYS[scope], JSON.stringify(area));
}

export async function clearPlaceArea(scope: AreaScope = "places"): Promise<void> {
  cache.delete(scope);
  await (await storage()).removeItem(KEYS[scope]);
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
