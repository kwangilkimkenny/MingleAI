/**
 * 파티 도구
 * - create_party: 에이전트 파티 생성
 * - get_party: 파티 정보 조회
 * - add_participant: 참가자 추가
 * - run_party: 파티 실행
 * - get_party_results: 파티 결과 조회
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { isAuthenticated } from "../config.js";

const CreatePartySchema = z.object({
  name: z.string().min(1).describe("파티 이름"),
  scheduledAt: z.string().describe("예정 일시 (ISO 8601)"),
  maxParticipants: z.number().min(4).max(100).default(20).optional().describe("최대 참가 인원"),
  theme: z.string().optional().describe("파티 테마 (예: '여행 좋아하는 사람들', '미식가 모임')"),
  roundCount: z.number().min(1).max(10).default(3).optional().describe("대화 라운드 수"),
  roundDurationMinutes: z.number().min(5).max(30).default(10).optional().describe("라운드당 시간(분)"),
});

const GetPartySchema = z.object({
  partyId: z.string().uuid().describe("파티 ID"),
});

const AddParticipantSchema = z.object({
  partyId: z.string().uuid().describe("파티 ID"),
  profileId: z.string().uuid().describe("참가자 프로필 ID"),
});

const RunPartySchema = z.object({
  partyId: z.string().uuid().describe("실행할 파티 ID"),
});

const GetPartyResultsSchema = z.object({
  partyId: z.string().uuid().describe("파티 ID"),
});

export function registerPartyTools(server: McpServer): void {
  // create_party
  server.tool(
    "create_party",
    "AI 에이전트 파티를 생성합니다. 파티는 여러 라운드로 구성되며, 각 라운드에서 에이전트들이 대화합니다. 로그인 필요.",
    CreatePartySchema.shape,
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
        const party = await apiClient.createParty(params);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                party: {
                  id: party.id,
                  name: party.name,
                  scheduledAt: party.scheduledAt,
                  maxParticipants: party.maxParticipants,
                  theme: party.theme,
                  roundCount: party.roundCount,
                  roundDurationMinutes: party.roundDurationMinutes,
                  status: party.status,
                },
                message: "파티가 생성되었습니다. add_participant로 참가자를 추가한 후 run_party로 실행하세요.",
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
                error: err.message || "파티 생성 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_party
  server.tool(
    "get_party",
    "파티 정보를 조회합니다. 상태, 참가자 수, 설정 등을 확인할 수 있습니다.",
    GetPartySchema.shape,
    async ({ partyId }) => {
      try {
        const party = await apiClient.getParty(partyId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                party,
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
                error: err.message || "파티 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // add_participant
  server.tool(
    "add_participant",
    "파티에 참가자(프로필)를 추가합니다. 해당 프로필의 AI 에이전트가 파티에 참가합니다. 로그인 필요.",
    AddParticipantSchema.shape,
    async ({ partyId, profileId }) => {
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
        await apiClient.addParticipant(partyId, profileId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `프로필 ${profileId}의 에이전트가 파티에 참가 등록되었습니다.`,
                partyId,
                profileId,
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
                error: err.message || "참가자 추가 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // run_party
  server.tool(
    "run_party",
    "파티를 실행합니다. 참가자들의 AI 에이전트가 각 라운드에서 대화를 나누고, 상호작용 신호가 기록됩니다. 로그인 필요.",
    RunPartySchema.shape,
    async ({ partyId }) => {
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
        const party = await apiClient.runParty(partyId);
        const roundCount = party.results?.rounds?.length || 0;
        const signalCount = party.results?.interactionSignals?.length || 0;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                party: {
                  id: party.id,
                  name: party.name,
                  status: party.status,
                },
                summary: {
                  roundsCompleted: roundCount,
                  interactionSignals: signalCount,
                },
                message: "파티가 완료되었습니다. get_party_results로 상세 결과를 확인하세요.",
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
                error: err.message || "파티 실행 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // get_party_results
  server.tool(
    "get_party_results",
    "완료된 파티의 결과를 조회합니다. 테이블 배정, 대화 컨텍스트, 상호작용 신호 등이 포함됩니다.",
    GetPartyResultsSchema.shape,
    async ({ partyId }) => {
      try {
        const { results } = await apiClient.getPartyResults(partyId);

        // 신호 요약
        const signalSummary: Record<string, number> = {};
        for (const signal of results.interactionSignals) {
          signalSummary[signal.signalType] = (signalSummary[signal.signalType] || 0) + 1;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                results: {
                  roundCount: results.rounds.length,
                  rounds: results.rounds.map((r) => ({
                    roundNumber: r.roundNumber,
                    tableCount: r.tables.length,
                    tables: r.tables.map((t) => ({
                      tableId: t.tableId,
                      participantCount: t.participants.length,
                      icebreaker: t.context.icebreaker,
                      topics: t.context.suggestedTopics,
                    })),
                  })),
                  signalSummary,
                  totalSignals: results.interactionSignals.length,
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
                error: err.message || "파티 결과 조회 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
