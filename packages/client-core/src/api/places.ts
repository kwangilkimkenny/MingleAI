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
): Promise<{ configured: boolean; area: string | null; places: NaverPlace[] }> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  const q = params.toString();
  return apiFetch<{ configured: boolean; area: string | null; places: NaverPlace[] }>(
    `/places/nearby${q ? `?${q}` : ""}`,
  );
}
