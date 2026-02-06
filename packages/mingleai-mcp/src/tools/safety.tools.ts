/**
 * 안전 도구
 * - check_content: 콘텐츠 안전 검사
 * - check_profile: 프로필 안전 검사
 * - report_user: 유저 신고
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { isAuthenticated } from "../config.js";

const SafetyContextEnum = z.enum(["profile_bio", "conversation", "message", "report"]);

const CheckContentSchema = z.object({
  content: z.string().describe("검사할 텍스트"),
  context: SafetyContextEnum.describe("콘텐츠 유형"),
});

const CheckProfileSchema = z.object({
  profileId: z.string().uuid().describe("검사할 프로필 ID"),
});

const ReportReasonEnum = z.enum([
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
]);

const ReportUserSchema = z.object({
  reportedProfileId: z.string().uuid().describe("피신고자 프로필 ID"),
  reason: ReportReasonEnum.describe("신고 사유"),
  details: z.string().max(1000).optional().describe("상세 내용"),
  evidencePartyId: z.string().uuid().optional().describe("증거가 있는 파티 세션 ID"),
});

export function registerSafetyTools(server: McpServer): void {
  // check_content
  server.tool(
    "check_content",
    "텍스트 콘텐츠의 안전성을 검사합니다. 개인정보 유출, 유해 콘텐츠, 사기 신호를 탐지합니다.",
    CheckContentSchema.shape,
    async ({ content, context }) => {
      try {
        const result = await apiClient.checkContent(content, context);

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedViolations = [...result.violations].sort(
          (a, b) =>
            (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
            (severityOrder[b.severity as keyof typeof severityOrder] || 4)
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                result: {
                  safe: result.safe,
                  riskScore: Math.round(result.riskScore * 100),
                  violationCount: result.violations.length,
                  violations: sortedViolations.map((v) => ({
                    type: v.type,
                    severity: v.severity,
                    description: v.description,
                  })),
                },
                message: result.safe
                  ? "콘텐츠가 안전합니다."
                  : `${result.violations.length}개의 위반 사항이 발견되었습니다.`,
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
                error: err.message || "콘텐츠 검사 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // check_profile
  server.tool(
    "check_profile",
    "프로필 전체에 대해 종합 안전 검증을 수행합니다. 이름, 자기소개, 직업 등 모든 텍스트 필드를 검사합니다.",
    CheckProfileSchema.shape,
    async ({ profileId }) => {
      try {
        // 프로필 조회
        const profile = await apiClient.getProfile(profileId);

        // 검사할 텍스트 수집
        const textsToCheck = [
          { field: "name", content: profile.name, context: "profile_bio" as const },
          { field: "bio", content: profile.bio || "", context: "profile_bio" as const },
          { field: "occupation", content: profile.occupation || "", context: "profile_bio" as const },
          { field: "location", content: profile.location, context: "profile_bio" as const },
        ];

        const results = await Promise.all(
          textsToCheck
            .filter((t) => t.content.length > 0)
            .map(async (t) => {
              const result = await apiClient.checkContent(t.content, t.context);
              return { field: t.field, ...result };
            })
        );

        // 종합 결과
        const allViolations = results.flatMap((r) =>
          r.violations.map((v) => ({ field: r.field, ...v }))
        );
        const maxRiskScore = Math.max(...results.map((r) => r.riskScore), 0);
        const overallSafe = results.every((r) => r.safe);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                profileId,
                currentRiskScore: profile.riskScore,
                result: {
                  safe: overallSafe,
                  riskScore: Math.round(maxRiskScore * 100),
                  violationCount: allViolations.length,
                  violations: allViolations.map((v) => ({
                    field: v.field,
                    type: v.type,
                    severity: v.severity,
                    description: v.description,
                  })),
                },
                message: overallSafe
                  ? "프로필이 안전합니다."
                  : `프로필에서 ${allViolations.length}개의 위반 사항이 발견되었습니다.`,
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
                error: err.message || "프로필 검사 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // report_user
  server.tool(
    "report_user",
    "사용자를 신고합니다. 위험 점수가 임계치를 넘으면 자동 정지됩니다. 로그인 필요.",
    ReportUserSchema.shape,
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
        const report = await apiClient.reportUser(params);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                report: {
                  id: report.id,
                  reportedProfileId: report.reportedProfileId,
                  reason: report.reason,
                  status: report.status,
                  createdAt: report.createdAt,
                },
                message: "신고가 접수되었습니다. 검토 후 조치됩니다.",
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
                error: err.message || "신고 접수 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
