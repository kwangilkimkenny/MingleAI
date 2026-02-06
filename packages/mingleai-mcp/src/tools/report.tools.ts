/**
 * 리포트 도구
 * - generate_report: 매칭 리포트 생성
 * - get_report: 리포트 조회
 * - list_reports: 리포트 목록
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { isAuthenticated } from "../config.js";

const GenerateReportSchema = z.object({
  partyId: z.string().uuid().describe("파티 ID"),
  profileId: z.string().uuid().describe("리포트 대상 프로필 ID"),
  reportType: z.enum(["summary", "detailed"]).default("summary").optional().describe("리포트 유형"),
});

const GetReportSchema = z.object({
  reportId: z.string().uuid().describe("리포트 ID"),
});

const ListReportsSchema = z.object({
  profileId: z.string().uuid().describe("프로필 ID"),
  limit: z.number().min(1).max(50).default(10).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export function registerReportTools(server: McpServer): void {
  // generate_report
  server.tool(
    "generate_report",
    "완료된 파티 결과를 바탕으로 매칭 리포트를 생성합니다. 호환성 점수, 대화 하이라이트, 추천 액션이 포함됩니다. 로그인 필요.",
    GenerateReportSchema.shape,
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
        const report = await apiClient.generateReport(params);

        // 상위 매칭 요약
        const topMatches = report.matchScores
          .sort((a, b) => b.overallScore - a.overallScore)
          .slice(0, 3)
          .map((m) => ({
            partnerId: m.partnerId,
            score: Math.round(m.overallScore * 100),
            breakdown: {
              values: Math.round(m.breakdown.valuesAlignment * 100),
              lifestyle: Math.round(m.breakdown.lifestyleCompatibility * 100),
              communication: Math.round(m.breakdown.communicationFit * 100),
              chemistry: Math.round(m.breakdown.interestChemistry * 100),
            },
          }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                report: {
                  id: report.id,
                  partyId: report.partyId,
                  profileId: report.profileId,
                  reportType: report.reportType,
                  createdAt: report.createdAt,
                },
                summary: {
                  totalMatches: report.matchScores.length,
                  topMatches,
                  recommendationCount: report.recommendations.length,
                },
                message: "리포트가 생성되었습니다. get_report로 상세 내용을 확인하세요.",
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
                error: err.message || "리포트 생성 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_report
  server.tool(
    "get_report",
    "리포트 상세 정보를 조회합니다. 모든 매칭 점수, 하이라이트, 추천 액션이 포함됩니다.",
    GetReportSchema.shape,
    async ({ reportId }) => {
      try {
        const report = await apiClient.getReport(reportId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                report: {
                  id: report.id,
                  partyId: report.partyId,
                  profileId: report.profileId,
                  reportType: report.reportType,
                  createdAt: report.createdAt,
                  matchScores: report.matchScores.map((m) => ({
                    partnerId: m.partnerId,
                    overallScore: Math.round(m.overallScore * 100),
                    breakdown: {
                      valuesAlignment: Math.round(m.breakdown.valuesAlignment * 100),
                      lifestyleCompatibility: Math.round(m.breakdown.lifestyleCompatibility * 100),
                      communicationFit: Math.round(m.breakdown.communicationFit * 100),
                      interestChemistry: Math.round(m.breakdown.interestChemistry * 100),
                    },
                  })),
                  highlights: report.highlights,
                  recommendations: report.recommendations,
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
                error: err.message || "리포트 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // list_reports
  server.tool(
    "list_reports",
    "사용자의 매칭 리포트 목록을 조회합니다.",
    ListReportsSchema.shape,
    async ({ profileId, limit, offset }) => {
      try {
        const reports = await apiClient.listReports(profileId, limit, offset);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                count: reports.length,
                reports: reports.map((r) => ({
                  id: r.id,
                  partyId: r.partyId,
                  reportType: r.reportType,
                  matchCount: r.matchScores.length,
                  topScore: r.matchScores.length > 0
                    ? Math.round(
                        Math.max(...r.matchScores.map((m) => m.overallScore)) * 100
                      )
                    : 0,
                  createdAt: r.createdAt,
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
                error: err.message || "리포트 목록 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
