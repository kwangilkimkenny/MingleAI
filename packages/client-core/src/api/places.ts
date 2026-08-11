import { apiFetch } from "./client.js";

/** A restaurant from Naver Local Search; `link` opens its Naver page (info + reservation). */
export type NaverPlace = {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  telephone: string;
  link: string;
  mapx: string;
  mapy: string;
};

/** Nearby restaurants for the 예약 tab. `configured=false` when the Naver key is unset.
 *  Pass coords to bias results to the user's neighborhood (server reverse-geocodes the area). */
export function getNearbyPlaces(
  query?: string,
  coords?: { lat: number; lng: number },
  /** 2 = "더 보기" — 서버가 질의 변형을 늘려 목록을 더 채운다(네이버 쿼터를 더 쓴다). */
  depth?: 1 | 2,
): Promise<{ configured: boolean; area: string | null; places: NaverPlace[] }> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  if (depth === 2) params.set("depth", "2");
  const q = params.toString();
  return apiFetch<{ configured: boolean; area: string | null; places: NaverPlace[] }>(
    `/places/nearby${q ? `?${q}` : ""}`,
  );
}

/** 사용자가 고를 수 있는 "갈 동네" 후보(라벨 + 좌표). */
export type AreaHit = { label: string; detail: string; lat: number; lng: number };

/** 동네 이름으로 좌표를 찾는다(맛집 탭 위치 지정). 입력은 호출부에서 디바운스할 것. */
export function searchAreas(query: string): Promise<{ areas: AreaHit[] }> {
  return apiFetch<{ areas: AreaHit[] }>(`/places/areas?query=${encodeURIComponent(query)}`);
}
