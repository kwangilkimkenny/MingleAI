/**
 * 프로필 도구
 * - create_profile: 프로필 생성 (에이전트 페르소나 자동 생성)
 * - get_profile: 프로필 조회
 * - update_profile: 프로필 수정
 * - list_profiles: 프로필 목록 (필터링)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { isAuthenticated } from "../config.js";

const GenderEnum = z.enum(["male", "female", "non_binary", "prefer_not_to_say"]);
const ToneEnum = z.enum(["warm", "witty", "direct", "thoughtful", "playful"]);
const RelationshipGoalEnum = z.enum(["casual", "dating", "serious", "marriage"]);
const GenderPreferenceEnum = z.enum(["male", "female", "non_binary", "any"]);

const PreferencesSchema = z.object({
  ageRange: z.object({
    min: z.number().min(19).max(100),
    max: z.number().min(19).max(100),
  }),
  genderPreference: z.array(GenderPreferenceEnum),
  locationRadius: z.number().min(1).max(500).describe("매칭 반경 (km)"),
  dealbreakers: z.array(z.string()).optional(),
});

const ValuesSchema = z.object({
  relationshipGoal: RelationshipGoalEnum,
  lifestyle: z.array(z.string()).describe("라이프스타일 키워드"),
  importantValues: z.array(z.string()).describe("중요 가치관"),
});

const CommunicationStyleSchema = z.object({
  tone: ToneEnum.describe("대화 톤"),
  topics: z.array(z.string()).describe("선호 대화 주제"),
});

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(50).describe("이름"),
  age: z.number().min(19).max(100).describe("나이 (19세 이상)"),
  gender: GenderEnum.describe("성별"),
  location: z.string().min(1).describe("거주 지역"),
  occupation: z.string().optional().describe("직업"),
  bio: z.string().max(500).optional().describe("자기소개 (최대 500자)"),
  preferences: PreferencesSchema.describe("매칭 선호도"),
  values: ValuesSchema.describe("가치관"),
  communicationStyle: CommunicationStyleSchema.describe("커뮤니케이션 스타일"),
});

const UpdateProfileSchema = z.object({
  profileId: z.string().uuid().describe("프로필 ID"),
  bio: z.string().max(500).optional(),
  location: z.string().optional(),
  preferences: PreferencesSchema.partial().optional(),
  values: ValuesSchema.partial().optional(),
  communicationStyle: CommunicationStyleSchema.partial().optional(),
});

const GetProfileSchema = z.object({
  profileId: z.string().uuid().describe("프로필 ID"),
});

const ListProfilesSchema = z.object({
  location: z.string().optional().describe("지역 필터"),
  ageMin: z.number().min(19).optional().describe("최소 나이"),
  ageMax: z.number().max(100).optional().describe("최대 나이"),
  relationshipGoal: RelationshipGoalEnum.optional().describe("관계 목표 필터"),
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export function registerProfileTools(server: McpServer): void {
  // create_profile
  server.tool(
    "create_profile",
    "새 프로필을 생성합니다. 입력 정보를 바탕으로 AI 에이전트 페르소나가 자동 생성됩니다. 로그인 필요.",
    CreateProfileSchema.shape,
    async (params) => {
      if (!isAuthenticated()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "로그인이 필요합니다. auth_login을 먼저 사용하세요.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const profile = await apiClient.createProfile(params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                profile: {
                  id: profile.id,
                  name: profile.name,
                  age: profile.age,
                  gender: profile.gender,
                  location: profile.location,
                  agentPersona: profile.agentPersona,
                },
                message: "프로필이 생성되었습니다. AI 에이전트 페르소나가 자동 생성되었습니다.",
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
                error: err.message || "프로필 생성 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_profile
  server.tool(
    "get_profile",
    "프로필 ID로 프로필 정보를 조회합니다.",
    GetProfileSchema.shape,
    async ({ profileId }) => {
      try {
        const profile = await apiClient.getProfile(profileId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                profile,
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
                error: err.message || "프로필 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // update_profile
  server.tool(
    "update_profile",
    "프로필을 수정합니다. 본인의 프로필만 수정 가능합니다. 로그인 필요.",
    UpdateProfileSchema.shape,
    async ({ profileId, ...updates }) => {
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
        const profile = await apiClient.updateProfile(profileId, updates);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                profile: {
                  id: profile.id,
                  name: profile.name,
                  bio: profile.bio,
                  location: profile.location,
                  updatedAt: profile.updatedAt,
                },
                message: "프로필이 수정되었습니다.",
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
                error: err.message || "프로필 수정 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // list_profiles
  server.tool(
    "list_profiles",
    "프로필 목록을 조회합니다. 지역, 나이, 관계 목표로 필터링 가능합니다.",
    ListProfilesSchema.shape,
    async (filters) => {
      try {
        const profiles = await apiClient.listProfiles(filters);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                count: profiles.length,
                profiles: profiles.map((p) => ({
                  id: p.id,
                  name: p.name,
                  age: p.age,
                  gender: p.gender,
                  location: p.location,
                  occupation: p.occupation,
                  relationshipGoal: (p.values as { relationshipGoal?: string })?.relationshipGoal,
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
                error: err.message || "프로필 목록 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
