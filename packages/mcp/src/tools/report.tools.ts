import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { ReportService } from "../services/report.service.js";

export function registerReportTools(server: McpServer, db: Database.Database): void {
  const service = new ReportService(db);

  server.tool(
    "generate_report",
    "완료된 파티 결과를 기반으로 매칭 리포트를 생성합니다. 호환성 점수, 대화 하이라이트, 추천 액션을 포함합니다.",
    {
      partyId: z.string().describe("파티 ID"),
      profileId: z.string().describe("리포트 대상 프로필 ID"),
      reportType: z.enum(["summary", "detailed"]).default("summary").describe("리포트 유형"),
    },
    async ({ partyId, profileId, reportType }) => {
      try {
        const report = service.generate(partyId, profileId, reportType);
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_report",
    "리포트 ID로 매칭 리포트를 조회합니다",
    {
      reportId: z.string().describe("리포트 ID"),
    },
    async ({ reportId }) => {
      const report = service.getById(reportId);
      if (!report) {
        return { content: [{ type: "text" as const, text: `리포트를 찾을 수 없습니다: ${reportId}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.tool(
    "list_reports",
    "사용자의 매칭 리포트 목록을 조회합니다",
    {
      profileId: z.string().describe("프로필 ID"),
      limit: z.number().int().min(1).max(50).default(10).describe("조회 수"),
      offset: z.number().int().min(0).default(0).describe("오프셋"),
    },
    async ({ profileId, limit, offset }) => {
      const reports = service.listByProfile(profileId, limit, offset);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ count: reports.length, reports }, null, 2),
        }],
      };
    }
  );
}
