import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { DatePlanService } from "../services/date-plan.service.js";

export function registerDatePlanTools(server: McpServer, db: Database.Database): void {
  const service = new DatePlanService(db);

  server.tool(
    "create_date_plan",
    "두 사용자의 선호도를 기반으로 최적화된 데이트 코스를 자동 생성합니다 (1~3개 옵션)",
    {
      profileId1: z.string().describe("첫 번째 사용자 프로필 ID"),
      profileId2: z.string().describe("두 번째 사용자 프로필 ID"),
      constraints: z.object({
        budget: z.object({
          total: z.number().min(0).describe("총 예산"),
          currency: z.string().default("KRW").describe("통화"),
        }),
        location: z.object({
          city: z.string().describe("도시"),
          district: z.string().optional().describe("구/동"),
          maxTravelMinutes: z.number().int().default(30).describe("최대 이동 시간(분)"),
        }),
        dateTime: z.object({
          preferredDate: z.string().describe("선호 날짜 (ISO 8601)"),
          durationHours: z.number().min(1).max(12).default(3).describe("데이트 시간(시)"),
        }),
        preferences: z.object({
          cuisineTypes: z.array(z.string()).optional().describe("선호 음식 종류"),
          activityTypes: z.array(z.string()).optional().describe("선호 활동 (cafe, walk, museum 등)"),
          avoidTypes: z.array(z.string()).optional().describe("피하고 싶은 활동"),
        }).optional(),
      }).describe("데이트 제약 조건"),
    },
    async ({ profileId1, profileId2, constraints }) => {
      try {
        const plan = service.create(profileId1, profileId2, constraints);
        return { content: [{ type: "text" as const, text: JSON.stringify(plan, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_date_plan",
    "데이트 플랜 ID로 데이트 계획을 조회합니다",
    {
      datePlanId: z.string().describe("데이트 플랜 ID"),
    },
    async ({ datePlanId }) => {
      const plan = service.getById(datePlanId);
      if (!plan) {
        return { content: [{ type: "text" as const, text: `데이트 플랜을 찾을 수 없습니다: ${datePlanId}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(plan, null, 2) }] };
    }
  );
}
