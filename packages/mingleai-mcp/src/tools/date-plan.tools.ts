/**
 * 데이트 플랜 도구
 * - create_date_plan: 데이트 코스 생성
 * - get_date_plan: 데이트 플랜 조회
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { isAuthenticated } from "../config.js";

const BudgetSchema = z.object({
  total: z.number().min(0).describe("총 예산"),
  currency: z.string().default("KRW").optional().describe("통화 (기본: KRW)"),
});

const LocationSchema = z.object({
  city: z.string().describe("도시"),
  district: z.string().optional().describe("구/동"),
  maxTravelMinutes: z.number().min(5).max(120).default(30).optional().describe("최대 이동 시간(분)"),
});

const DateTimeSchema = z.object({
  preferredDate: z.string().describe("선호 날짜 (ISO 8601)"),
  durationHours: z.number().min(1).max(12).default(3).optional().describe("데이트 시간(시)"),
});

const PreferencesSchema = z.object({
  cuisineTypes: z.array(z.string()).optional().describe("선호 음식 (예: 한식, 이탈리안)"),
  activityTypes: z.array(z.string()).optional().describe("선호 활동 (예: 카페, 산책, 전시회)"),
  avoidTypes: z.array(z.string()).optional().describe("피하고 싶은 것 (예: 술집, 노래방)"),
});

const CreateDatePlanSchema = z.object({
  profileId1: z.string().uuid().describe("첫 번째 사용자 프로필 ID"),
  profileId2: z.string().uuid().describe("두 번째 사용자 프로필 ID"),
  budget: BudgetSchema.describe("예산"),
  location: LocationSchema.describe("장소"),
  dateTime: DateTimeSchema.describe("일시"),
  preferences: PreferencesSchema.optional().describe("선호 사항"),
});

const GetDatePlanSchema = z.object({
  datePlanId: z.string().uuid().describe("데이트 플랜 ID"),
});

export function registerDatePlanTools(server: McpServer): void {
  // create_date_plan
  server.tool(
    "create_date_plan",
    "두 사용자의 선호도를 기반으로 최적화된 데이트 코스를 자동 생성합니다. 1~3개의 코스 옵션이 제공됩니다. 로그인 필요.",
    CreateDatePlanSchema.shape,
    async (params) => {
      if (!isAuthenticated()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "로그인이 필요합니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const datePlan = await apiClient.createDatePlan(params);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                datePlan: {
                  id: datePlan.id,
                  profileId1: datePlan.profileId1,
                  profileId2: datePlan.profileId2,
                  status: datePlan.status,
                  createdAt: datePlan.createdAt,
                },
                courses: datePlan.courses.map((course) => ({
                  courseId: course.courseId,
                  theme: course.theme,
                  totalCost: course.totalCost,
                  totalDuration: course.totalDuration,
                  stopCount: course.stops.length,
                  stops: course.stops.map((stop) => ({
                    order: stop.order,
                    venue: stop.venue,
                    category: stop.category,
                    duration: stop.duration,
                    cost: stop.cost,
                    note: stop.note,
                  })),
                })),
                message: `${datePlan.courses.length}개의 데이트 코스가 생성되었습니다.`,
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
                error: err.message || "데이트 플랜 생성 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_date_plan
  server.tool(
    "get_date_plan",
    "데이트 플랜 상세 정보를 조회합니다.",
    GetDatePlanSchema.shape,
    async ({ datePlanId }) => {
      try {
        const datePlan = await apiClient.getDatePlan(datePlanId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                datePlan: {
                  id: datePlan.id,
                  profileId1: datePlan.profileId1,
                  profileId2: datePlan.profileId2,
                  constraints: datePlan.constraints,
                  status: datePlan.status,
                  createdAt: datePlan.createdAt,
                  courses: datePlan.courses.map((course) => ({
                    courseId: course.courseId,
                    theme: course.theme,
                    totalCost: course.totalCost,
                    totalDuration: course.totalDuration,
                    stops: course.stops,
                  })),
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
                error: err.message || "데이트 플랜 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
