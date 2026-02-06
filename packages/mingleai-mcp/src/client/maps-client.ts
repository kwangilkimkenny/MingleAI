/**
 * Kakao Maps API 클라이언트
 * 장소 검색 및 경로 계산에 사용
 */

import axios from "axios";
import { config } from "../config.js";

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
  distance?: string;
}

export interface KakaoSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoPlace[];
}

export interface Venue {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  address: string;
  roadAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  url?: string;
  distance?: number;
  priceRange?: "low" | "medium" | "high";
}

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  summary: string;
}

// Kakao 카테고리 그룹 코드
export const CATEGORY_GROUPS = {
  MT1: "대형마트",
  CS2: "편의점",
  PS3: "어린이집",
  SC4: "학교",
  AC5: "학원",
  PK6: "주차장",
  OL7: "주유소",
  SW8: "지하철역",
  BK9: "은행",
  CT1: "문화시설",
  AG2: "중개업소",
  PO3: "공공기관",
  AT4: "관광명소",
  AD5: "숙박",
  FD6: "음식점",
  CE7: "카페",
  HP8: "병원",
  PM9: "약국",
} as const;

export class MapsClient {
  private baseUrl = "https://dapi.kakao.com/v2/local";

  private getHeaders() {
    if (!config.kakaoApiKey) {
      throw new Error("KAKAO_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요.");
    }
    return {
      Authorization: `KakaoAK ${config.kakaoApiKey}`,
    };
  }

  /**
   * 키워드로 장소 검색
   */
  async searchByKeyword(
    query: string,
    options?: {
      x?: number; // 경도 (중심 좌표)
      y?: number; // 위도 (중심 좌표)
      radius?: number; // 검색 반경 (미터, 최대 20000)
      categoryGroupCode?: keyof typeof CATEGORY_GROUPS;
      page?: number;
      size?: number;
      sort?: "accuracy" | "distance";
    }
  ): Promise<Venue[]> {
    const params: Record<string, string | number> = {
      query,
      page: options?.page || 1,
      size: options?.size || 15,
      sort: options?.sort || "accuracy",
    };

    if (options?.x && options?.y) {
      params.x = options.x;
      params.y = options.y;
      params.radius = options.radius || 5000;
    }

    if (options?.categoryGroupCode) {
      params.category_group_code = options.categoryGroupCode;
    }

    try {
      const response = await axios.get<KakaoSearchResponse>(
        `${this.baseUrl}/search/keyword.json`,
        {
          headers: this.getHeaders(),
          params,
        }
      );

      return response.data.documents.map((doc) => this.toVenue(doc));
    } catch (error) {
      console.error("Kakao API error:", error);
      throw new Error("장소 검색에 실패했습니다.");
    }
  }

  /**
   * 카테고리로 장소 검색
   */
  async searchByCategory(
    categoryGroupCode: keyof typeof CATEGORY_GROUPS,
    x: number,
    y: number,
    options?: {
      radius?: number;
      page?: number;
      size?: number;
      sort?: "accuracy" | "distance";
    }
  ): Promise<Venue[]> {
    const params: Record<string, string | number> = {
      category_group_code: categoryGroupCode,
      x,
      y,
      radius: options?.radius || 5000,
      page: options?.page || 1,
      size: options?.size || 15,
      sort: options?.sort || "distance",
    };

    try {
      const response = await axios.get<KakaoSearchResponse>(
        `${this.baseUrl}/search/category.json`,
        {
          headers: this.getHeaders(),
          params,
        }
      );

      return response.data.documents.map((doc) => this.toVenue(doc));
    } catch (error) {
      console.error("Kakao API error:", error);
      throw new Error("카테고리 검색에 실패했습니다.");
    }
  }

  /**
   * 주소로 좌표 검색 (Geocoding)
   */
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await axios.get<{
        documents: Array<{ x: string; y: string }>;
      }>(`${this.baseUrl}/search/address.json`, {
        headers: this.getHeaders(),
        params: { query: address },
      });

      if (response.data.documents.length === 0) {
        return null;
      }

      const doc = response.data.documents[0];
      return {
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  }

  /**
   * 두 지점 간 거리 계산 (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // 지구 반경 (미터)
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 미터 단위
  }

  /**
   * 예상 이동 시간 계산 (도보 기준)
   */
  estimateWalkingTime(distanceMeters: number): number {
    // 평균 도보 속도: 5km/h = 83.3m/min
    return Math.ceil(distanceMeters / 83.3);
  }

  /**
   * 예상 이동 시간 계산 (대중교통 기준)
   */
  estimateTransitTime(distanceMeters: number): number {
    // 평균 대중교통 속도: 20km/h = 333m/min (대기 시간 포함)
    return Math.ceil(distanceMeters / 333) + 5; // +5분 대기
  }

  /**
   * 데이트 코스용 장소 추천
   */
  async recommendDateVenues(
    city: string,
    district?: string,
    options?: {
      cuisineTypes?: string[];
      activityTypes?: string[];
      avoidTypes?: string[];
      budget?: "low" | "medium" | "high";
    }
  ): Promise<{
    restaurants: Venue[];
    cafes: Venue[];
    attractions: Venue[];
  }> {
    // 지역 좌표 얻기
    const address = district ? `${city} ${district}` : city;
    const coords = await this.geocode(address);

    if (!coords) {
      throw new Error(`주소를 찾을 수 없습니다: ${address}`);
    }

    // 병렬로 장소 검색
    const [restaurants, cafes, attractions] = await Promise.all([
      this.searchByCategory("FD6", coords.lng, coords.lat, {
        radius: 3000,
        size: 10,
        sort: "distance",
      }),
      this.searchByCategory("CE7", coords.lng, coords.lat, {
        radius: 3000,
        size: 10,
        sort: "distance",
      }),
      this.searchByCategory("AT4", coords.lng, coords.lat, {
        radius: 5000,
        size: 10,
        sort: "distance",
      }),
    ]);

    // 필터링
    const filterByPreference = (venues: Venue[], avoid?: string[]): Venue[] => {
      if (!avoid || avoid.length === 0) return venues;
      return venues.filter(
        (v) =>
          !avoid.some(
            (a) =>
              v.name.toLowerCase().includes(a.toLowerCase()) ||
              v.category.toLowerCase().includes(a.toLowerCase())
          )
      );
    };

    return {
      restaurants: filterByPreference(restaurants, options?.avoidTypes),
      cafes: filterByPreference(cafes, options?.avoidTypes),
      attractions: filterByPreference(attractions, options?.avoidTypes),
    };
  }

  private toVenue(doc: KakaoPlace): Venue {
    return {
      id: doc.id,
      name: doc.place_name,
      category: doc.category_name,
      categoryGroup: doc.category_group_name,
      address: doc.address_name,
      roadAddress: doc.road_address_name,
      location: {
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
      },
      phone: doc.phone || undefined,
      url: doc.place_url || undefined,
      distance: doc.distance ? parseInt(doc.distance, 10) : undefined,
    };
  }
}

// 싱글톤 인스턴스
export const mapsClient = new MapsClient();
