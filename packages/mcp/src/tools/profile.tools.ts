import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { ProfileService } from "../services/profile.service.js";

export function registerProfileTools(server: McpServer, db: Database.Database): void {
  const service = new ProfileService(db);

  server.tool(
    "create_profile",
    "사용자 프로필을 생성하고 Another I 에이전트 페르소나를 자동 생성합니다",
    {
      userId: z.string().describe("사용자 고유 ID"),
      name: z.string().describe("이름"),
      age: z.number().int().min(19).max(100).describe("나이 (19세 이상)"),
      gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).describe("성별"),
      location: z.string().describe("거주 지역"),
      occupation: z.string().optional().describe("직업"),
      preferences: z.object({
        ageRange: z.object({ min: z.number(), max: z.number() }),
        genderPreference: z.array(z.enum(["male", "female", "non_binary", "any"])),
        locationRadius: z.number().describe("매칭 반경(km)"),
        dealbreakers: z.array(z.string()).optional(),
      }).describe("매칭 선호도"),
      values: z.object({
        relationshipGoal: z.enum(["casual", "dating", "serious", "marriage"]).describe("관계 목표"),
        lifestyle: z.array(z.string()).describe("라이프스타일 키워드"),
        importantValues: z.array(z.string()).describe("중요 가치관"),
      }).describe("가치관"),
      communicationStyle: z.object({
        tone: z.enum(["warm", "witty", "direct", "thoughtful", "playful"]).describe("대화 톤"),
        topics: z.array(z.string()).describe("선호 대화 주제"),
      }).describe("커뮤니케이션 스타일"),
      bio: z.string().max(500).optional().describe("자기소개 (최대 500자)"),
    },
    async (args) => {
      try {
        const profile = service.create(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_profile",
    "프로필 ID로 사용자 프로필을 조회합니다",
    {
      profileId: z.string().describe("프로필 ID"),
    },
    async ({ profileId }) => {
      const profile = service.getById(profileId);
      if (!profile) {
        return { content: [{ type: "text" as const, text: `프로필을 찾을 수 없습니다: ${profileId}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }] };
    }
  );

  server.tool(
    "update_profile",
    "기존 프로필을 부분 업데이트합니다",
    {
      profileId: z.string().describe("프로필 ID"),
      preferences: z.object({
        ageRange: z.object({ min: z.number(), max: z.number() }),
        genderPreference: z.array(z.enum(["male", "female", "non_binary", "any"])),
        locationRadius: z.number(),
        dealbreakers: z.array(z.string()).optional(),
      }).optional(),
      values: z.object({
        relationshipGoal: z.enum(["casual", "dating", "serious", "marriage"]),
        lifestyle: z.array(z.string()),
        importantValues: z.array(z.string()),
      }).optional(),
      communicationStyle: z.object({
        tone: z.enum(["warm", "witty", "direct", "thoughtful", "playful"]),
        topics: z.array(z.string()),
      }).optional(),
      bio: z.string().max(500).optional(),
      location: z.string().optional(),
    },
    async ({ profileId, ...updates }) => {
      try {
        const profile = service.update(profileId, updates);
        return { content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_profiles",
    "프로필 목록을 조회합니다 (필터링 지원)",
    {
      relationshipGoal: z.enum(["casual", "dating", "serious", "marriage"]).optional().describe("관계 목표 필터"),
      location: z.string().optional().describe("지역 필터"),
      ageMin: z.number().int().optional().describe("최소 나이"),
      ageMax: z.number().int().optional().describe("최대 나이"),
      limit: z.number().int().min(1).max(100).default(20).describe("조회 수"),
      offset: z.number().int().min(0).default(0).describe("오프셋"),
    },
    async ({ limit, offset, ...filters }) => {
      const profiles = service.list(
        Object.keys(filters).length > 0 ? filters : undefined,
        limit,
        offset
      );
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ count: profiles.length, profiles }, null, 2),
        }],
      };
    }
  );
}
