/**
 * 맛집 카드의 "예약" 동선. 네이버 지역검색이 주는 `link`는 가게 홈페이지일 수도, 실제 예약
 * 페이지(캐치테이블·네이버예약·테이블링 등)일 수도 있다. 예약 서비스로 보이는 링크만 예약
 * 버튼으로 승격하고, 아니면 네이버 지도 장소 페이지(거기서 예약·전화 가능)로 보낸다.
 * 공개된 네이버 '예약' API는 없으므로 앱 안에서 예약을 완결할 수는 없다 — 링크까지가 경계다.
 */
export type ReservationTarget = {
  /** 버튼 라벨 — 어디로 가는지 먼저 알려준다. */
  label: string;
  url: string;
  /** 예약 서비스로 바로 가는 링크인지(카드에 '예약' 배지를 붙일지). */
  bookable: boolean;
  /** 배지에 쓸 짧은 제공자 이름. bookable일 때만. */
  provider?: string;
};

const PROVIDERS: { match: RegExp; name: string }[] = [
  { match: /(^|\.)catchtable\.co\.kr$/i, name: "캐치테이블" },
  { match: /(^|\.)booking\.naver\.com$/i, name: "네이버예약" },
  { match: /(^|\.)tabling\.co\.kr$/i, name: "테이블링" },
  { match: /(^|\.)poingapp\.com$/i, name: "포잉" },
  { match: /(^|\.)yanolja\.com$/i, name: "야놀자" },
  { match: /(^|\.)mangoplate\.com$/i, name: "망고플레이트" },
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** 네이버 지도 장소 검색 — 예약·전화·길찾기가 모두 붙어 있는 공식 페이지. */
export function naverMapUrl(title: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(title)}`;
}

export function reservationTarget(place: { title: string; link?: string }): ReservationTarget {
  const host = place.link ? hostOf(place.link) : null;
  const hit = host ? PROVIDERS.find((p) => p.match.test(host)) : undefined;
  if (hit && place.link) {
    return { label: `${hit.name}에서 예약`, url: place.link, bookable: true, provider: hit.name };
  }
  return { label: "네이버에서 예약", url: naverMapUrl(place.title), bookable: false };
}

/** 전화번호가 있을 때만 전화 링크(네이버 지역검색은 대부분 빈 값으로 준다). */
export function telUrl(telephone?: string): string | null {
  const digits = (telephone ?? "").replace(/[^0-9+]/g, "");
  return digits.length >= 8 ? `tel:${digits}` : null;
}

/** "음식점>일식>초밥,롤" → "초밥,롤" (배지에 쓰는 잎 카테고리). */
export function categoryLeaf(category: string): string {
  const parts = category.split(">").filter(Boolean);
  return parts[parts.length - 1] ?? category;
}
