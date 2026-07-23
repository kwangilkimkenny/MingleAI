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

/** Nearby restaurants for the 네이버 예약 tab. `configured=false` when the Naver key is unset. */
export function getNearbyPlaces(
  query?: string,
): Promise<{ configured: boolean; places: NaverPlace[] }> {
  const q = query ? `?query=${encodeURIComponent(query)}` : "";
  return apiFetch<{ configured: boolean; places: NaverPlace[] }>(`/places/nearby${q}`);
}
