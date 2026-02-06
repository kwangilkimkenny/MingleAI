/**
 * 장소 검색 도구
 * - search_venues: 키워드로 장소 검색
 * - search_nearby: 주변 장소 검색
 * - recommend_date_spots: 데이트 장소 추천
 * - get_travel_time: 이동 시간 계산
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mapsClient, CATEGORY_GROUPS } from "../client/maps-client.js";
import { config } from "../config.js";

const CategoryEnum = z.enum([
  "MT1", "CS2", "PS3", "SC4", "AC5", "PK6", "OL7", "SW8", "BK9",
  "CT1", "AG2", "PO3", "AT4", "AD5", "FD6", "CE7", "HP8", "PM9",
]);

const SearchVenuesSchema = z.object({
  query: z.string().describe("검색 키워드 (예: '강남 이탈리안 레스토랑')"),
  location: z.object({
    lat: z.number().describe("위도"),
    lng: z.number().describe("경도"),
  }).optional().describe("검색 중심 좌표 (없으면 전국 검색)"),
  radius: z.number().min(100).max(20000).default(5000).optional().describe("검색 반경 (미터)"),
  category: CategoryEnum.optional().describe("카테고리 필터 (FD6=음식점, CE7=카페, AT4=관광명소 등)"),
  limit: z.number().min(1).max(15).default(10).optional().describe("결과 수"),
});

const SearchNearbySchema = z.object({
  address: z.string().describe("검색 중심 주소 (예: '서울 강남구 역삼동')"),
  category: CategoryEnum.describe("카테고리 (FD6=음식점, CE7=카페, AT4=관광명소, CT1=문화시설)"),
  radius: z.number().min(100).max(20000).default(3000).optional().describe("검색 반경 (미터)"),
  limit: z.number().min(1).max(15).default(10).optional().describe("결과 수"),
});

const RecommendDateSpotsSchema = z.object({
  city: z.string().describe("도시 (예: '서울')"),
  district: z.string().optional().describe("구/동 (예: '강남구')"),
  cuisineTypes: z.array(z.string()).optional().describe("선호 음식 (예: ['한식', '이탈리안'])"),
  activityTypes: z.array(z.string()).optional().describe("선호 활동"),
  avoidTypes: z.array(z.string()).optional().describe("피할 유형"),
});

const GetTravelTimeSchema = z.object({
  from: z.object({
    lat: z.number(),
    lng: z.number(),
  }).describe("출발지 좌표"),
  to: z.object({
    lat: z.number(),
    lng: z.number(),
  }).describe("도착지 좌표"),
  mode: z.enum(["walking", "transit"]).default("transit").optional().describe("이동 수단"),
});

const GeocodeSchema = z.object({
  address: z.string().describe("주소 (예: '서울 강남구 테헤란로 152')"),
});

export function registerVenueTools(server: McpServer): void {
  // search_venues
  server.tool(
    "search_venues",
    "키워드로 장소를 검색합니다. 음식점, 카페, 관광지 등을 검색할 수 있습니다. KAKAO_API_KEY 필요.",
    SearchVenuesSchema.shape,
    async ({ query, location, radius, category, limit }) => {
      if (!config.kakaoApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "KAKAO_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const venues = await mapsClient.searchByKeyword(query, {
          x: location?.lng,
          y: location?.lat,
          radius,
          categoryGroupCode: category as keyof typeof CATEGORY_GROUPS,
          size: limit,
          sort: location ? "distance" : "accuracy",
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                query,
                count: venues.length,
                venues: venues.map((v) => ({
                  id: v.id,
                  name: v.name,
                  category: v.category,
                  address: v.roadAddress || v.address,
                  location: v.location,
                  phone: v.phone,
                  url: v.url,
                  distance: v.distance ? `${v.distance}m` : undefined,
                })),
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "장소 검색 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // search_nearby
  server.tool(
    "search_nearby",
    "주소를 기준으로 주변 장소를 카테고리별로 검색합니다. KAKAO_API_KEY 필요.",
    SearchNearbySchema.shape,
    async ({ address, category, radius, limit }) => {
      if (!config.kakaoApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "KAKAO_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        // 주소 → 좌표 변환
        const coords = await mapsClient.geocode(address);
        if (!coords) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: `주소를 찾을 수 없습니다: ${address}`,
                }),
              },
            ],
            isError: true,
          };
        }

        const venues = await mapsClient.searchByCategory(
          category as keyof typeof CATEGORY_GROUPS,
          coords.lng,
          coords.lat,
          { radius, size: limit, sort: "distance" }
        );

        const categoryName = CATEGORY_GROUPS[category as keyof typeof CATEGORY_GROUPS];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                center: {
                  address,
                  location: coords,
                },
                category: categoryName,
                radius: `${radius || 3000}m`,
                count: venues.length,
                venues: venues.map((v) => ({
                  id: v.id,
                  name: v.name,
                  category: v.category,
                  address: v.roadAddress || v.address,
                  location: v.location,
                  phone: v.phone,
                  url: v.url,
                  distance: v.distance ? `${v.distance}m` : undefined,
                })),
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "주변 검색 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // recommend_date_spots
  server.tool(
    "recommend_date_spots",
    "데이트에 적합한 장소를 추천합니다. 음식점, 카페, 관광명소를 한번에 검색합니다. KAKAO_API_KEY 필요.",
    RecommendDateSpotsSchema.shape,
    async ({ city, district, cuisineTypes, activityTypes, avoidTypes }) => {
      if (!config.kakaoApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "KAKAO_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const recommendations = await mapsClient.recommendDateVenues(
          city,
          district,
          { cuisineTypes, activityTypes, avoidTypes }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                location: district ? `${city} ${district}` : city,
                preferences: {
                  cuisineTypes: cuisineTypes || [],
                  activityTypes: activityTypes || [],
                  avoidTypes: avoidTypes || [],
                },
                recommendations: {
                  restaurants: recommendations.restaurants.slice(0, 5).map((v) => ({
                    name: v.name,
                    category: v.category,
                    address: v.roadAddress || v.address,
                    phone: v.phone,
                    url: v.url,
                    distance: v.distance ? `${v.distance}m` : undefined,
                  })),
                  cafes: recommendations.cafes.slice(0, 5).map((v) => ({
                    name: v.name,
                    category: v.category,
                    address: v.roadAddress || v.address,
                    phone: v.phone,
                    url: v.url,
                    distance: v.distance ? `${v.distance}m` : undefined,
                  })),
                  attractions: recommendations.attractions.slice(0, 5).map((v) => ({
                    name: v.name,
                    category: v.category,
                    address: v.roadAddress || v.address,
                    phone: v.phone,
                    url: v.url,
                    distance: v.distance ? `${v.distance}m` : undefined,
                  })),
                },
                message: `${city}${district ? ` ${district}` : ""} 지역의 데이트 장소 추천이 완료되었습니다.`,
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "장소 추천 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_travel_time
  server.tool(
    "get_travel_time",
    "두 지점 간의 예상 이동 시간을 계산합니다.",
    GetTravelTimeSchema.shape,
    async ({ from, to, mode }) => {
      try {
        const distance = mapsClient.calculateDistance(
          from.lat,
          from.lng,
          to.lat,
          to.lng
        );

        const travelTime =
          mode === "walking"
            ? mapsClient.estimateWalkingTime(distance)
            : mapsClient.estimateTransitTime(distance);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                route: {
                  from,
                  to,
                  mode: mode || "transit",
                  distance: {
                    meters: Math.round(distance),
                    km: (distance / 1000).toFixed(2),
                  },
                  estimatedTime: {
                    minutes: travelTime,
                    display:
                      travelTime >= 60
                        ? `${Math.floor(travelTime / 60)}시간 ${travelTime % 60}분`
                        : `${travelTime}분`,
                  },
                },
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "이동 시간 계산 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // geocode
  server.tool(
    "geocode",
    "주소를 좌표(위도, 경도)로 변환합니다. KAKAO_API_KEY 필요.",
    GeocodeSchema.shape,
    async ({ address }) => {
      if (!config.kakaoApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "KAKAO_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const coords = await mapsClient.geocode(address);

        if (!coords) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: `주소를 찾을 수 없습니다: ${address}`,
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                address,
                location: coords,
              }),
            },
          ],
        };
      } catch (error) {
        const err = error as { message?: string };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err.message || "좌표 변환 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
