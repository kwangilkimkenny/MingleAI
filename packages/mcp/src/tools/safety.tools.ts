import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { SafetyService } from "../services/safety.service.js";
import { ProfileRepo } from "../storage/profile.repo.js";

export function registerSafetyTools(server: McpServer, db: Database.Database): void {
  const safety = new SafetyService(db);
  const profileRepo = new ProfileRepo(db);

  server.tool(
    "check_content",
    "텍스트 콘텐츠의 안전성을 검사합니다 (개인정보 유출, 유해 콘텐츠, 사기 신호 탐지)",
    {
      content: z.string().describe("검사할 텍스트"),
      context: z.enum(["profile_bio", "conversation", "message", "report"]).describe("콘텐츠 유형"),
    },
    async ({ content, context }) => {
      const result = safety.checkContent(content, context);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "check_profile",
    "프로필 전체에 대해 종합 안전 검증을 수행합니다",
    {
      profileId: z.string().describe("검사할 프로필 ID"),
    },
    async ({ profileId }) => {
      const profile = profileRepo.findById(profileId);
      if (!profile) {
        return { content: [{ type: "text" as const, text: `프로필을 찾을 수 없습니다: ${profileId}` }], isError: true };
      }

      const results: Record<string, unknown> = {
        profileId,
        overallSafe: true,
        checks: {} as Record<string, unknown>,
      };

      // Check bio
      if (profile.bio) {
        const bioCheck = safety.checkContent(profile.bio, "profile_bio");
        (results.checks as Record<string, unknown>).bio = bioCheck;
        if (!bioCheck.safe) results.overallSafe = false;
      }

      // Check name for suspicious patterns
      const nameCheck = safety.checkContent(profile.name, "profile_bio");
      (results.checks as Record<string, unknown>).name = nameCheck;
      if (!nameCheck.safe) results.overallSafe = false;

      // Risk score assessment
      results.riskScore = profile.riskScore;
      results.status = profile.status;
      if (profile.riskScore >= 0.5) {
        results.warning = "높은 위험 점수 - 검토가 필요합니다";
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "report_user",
    "사용자에 대한 안전 신고를 접수합니다. 위험 점수가 임계치를 넘으면 자동 정지됩니다.",
    {
      reporterProfileId: z.string().describe("신고자 프로필 ID"),
      reportedProfileId: z.string().describe("피신고자 프로필 ID"),
      reason: z.enum(["harassment", "fraud", "fake_profile", "inappropriate_content", "spam", "other"]).describe("신고 사유"),
      details: z.string().max(1000).optional().describe("상세 내용"),
      evidencePartyId: z.string().optional().describe("증거가 있는 파티 세션 ID"),
    },
    async ({ reporterProfileId, reportedProfileId, reason, details, evidencePartyId }) => {
      try {
        const report = safety.reportUser(reporterProfileId, reportedProfileId, reason, details, evidencePartyId);
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );
}
