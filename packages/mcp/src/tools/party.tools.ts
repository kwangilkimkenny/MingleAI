import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { PartyService } from "../services/party.service.js";

export function registerPartyTools(server: McpServer, db: Database.Database): void {
  const service = new PartyService(db);

  server.tool(
    "create_party",
    "에이전트 파티 세션을 생성합니다. Another I 에이전트들이 대화하는 가상 소셜 이벤트입니다.",
    {
      name: z.string().describe("파티 이름"),
      scheduledAt: z.string().describe("예정 일시 (ISO 8601)"),
      maxParticipants: z.number().int().min(4).max(100).default(20).describe("최대 참가 인원"),
      theme: z.string().optional().describe("파티 테마 (예: '여행 좋아하는 사람들', '미식가 모임')"),
      roundCount: z.number().int().min(1).max(10).default(3).describe("대화 라운드 수"),
      roundDurationMinutes: z.number().int().min(5).max(30).default(10).describe("라운드당 시간(분)"),
    },
    async (args) => {
      try {
        const party = service.create(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(party, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "add_participant",
    "파티에 사용자의 Another I 에이전트를 참가 등록합니다",
    {
      partyId: z.string().describe("파티 ID"),
      profileId: z.string().describe("참가자 프로필 ID"),
    },
    async ({ partyId, profileId }) => {
      try {
        const result = service.addParticipant(partyId, profileId);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: true, ...result }, null, 2),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "run_party",
    "에이전트 파티를 실행합니다. 참가자를 테이블에 배정하고, 대화 컨텍스트를 생성하며, 상호작용 신호를 산출합니다.",
    {
      partyId: z.string().describe("실행할 파티 ID"),
    },
    async ({ partyId }) => {
      try {
        const results = service.run(partyId);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `오류: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_party_results",
    "완료된 파티의 결과를 조회합니다 (테이블 배정, 대화 컨텍스트, 상호작용 신호)",
    {
      partyId: z.string().describe("파티 ID"),
    },
    async ({ partyId }) => {
      const party = service.getResults(partyId);
      if (!party) {
        return { content: [{ type: "text" as const, text: `파티를 찾을 수 없습니다: ${partyId}` }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(party, null, 2) }] };
    }
  );
}
