/**
 * AI 대화 시뮬레이션 도구
 * - simulate_conversation: 두 에이전트 간 대화 시뮬레이션
 * - analyze_compatibility: 호환성 심층 분석
 * - generate_icebreaker: 맞춤형 아이스브레이커 생성
 * - suggest_message: 대화 메시지 추천
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../client/api-client.js";
import { claudeClient } from "../client/claude-client.js";
import { config } from "../config.js";

const SimulateConversationSchema = z.object({
  profileId1: z.string().uuid().describe("첫 번째 에이전트의 프로필 ID"),
  profileId2: z.string().uuid().describe("두 번째 에이전트의 프로필 ID"),
  icebreaker: z.string().optional().describe("대화 시작 주제 (없으면 자동 생성)"),
  topics: z.array(z.string()).optional().describe("추천 대화 주제"),
  messageCount: z.number().min(2).max(20).default(6).optional().describe("대화 메시지 수"),
});

const AnalyzeCompatibilitySchema = z.object({
  profileId1: z.string().uuid().describe("첫 번째 프로필 ID"),
  profileId2: z.string().uuid().describe("두 번째 프로필 ID"),
});

const GenerateIcebreakerSchema = z.object({
  profileId1: z.string().uuid().describe("첫 번째 프로필 ID"),
  profileId2: z.string().uuid().describe("두 번째 프로필 ID"),
  context: z.string().optional().describe("상황 설명 (예: '소개팅', '그룹 미팅')"),
});

const SuggestMessageSchema = z.object({
  senderProfileId: z.string().uuid().describe("보내는 사람 프로필 ID"),
  receiverProfileId: z.string().uuid().describe("받는 사람 프로필 ID"),
  conversationHistory: z.array(z.string()).optional().describe("이전 대화 내용"),
  context: z.string().optional().describe("상황 설명"),
});

export function registerConversationTools(server: McpServer): void {
  // simulate_conversation
  server.tool(
    "simulate_conversation",
    "두 프로필의 AI 에이전트 간 대화를 시뮬레이션합니다. Claude AI가 각 에이전트의 페르소나를 기반으로 자연스러운 대화를 생성합니다. ANTHROPIC_API_KEY 필요.",
    SimulateConversationSchema.shape,
    async ({ profileId1, profileId2, icebreaker, topics, messageCount }) => {
      if (!config.claudeApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        // 두 프로필 조회
        const [profile1, profile2] = await Promise.all([
          apiClient.getProfile(profileId1),
          apiClient.getProfile(profileId2),
        ]);

        // 아이스브레이커 자동 생성 (없는 경우)
        let finalIcebreaker = icebreaker;
        let finalTopics = topics || [];

        if (!finalIcebreaker) {
          const icebreakerResult = await claudeClient.generateIcebreaker(
            profile1.agentPersona,
            profile2.agentPersona
          );
          finalIcebreaker = icebreakerResult.icebreaker;
          if (finalTopics.length === 0) {
            finalTopics = icebreakerResult.suggestedTopics;
          }
        }

        // 대화 시뮬레이션
        const result = await claudeClient.simulateConversation(
          profile1.agentPersona,
          profile1.name,
          profile2.agentPersona,
          profile2.name,
          finalIcebreaker,
          finalTopics,
          messageCount || 6
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                conversation: {
                  participants: [
                    { profileId: profileId1, name: profile1.name },
                    { profileId: profileId2, name: profile2.name },
                  ],
                  icebreaker: finalIcebreaker,
                  topics: finalTopics,
                  messageCount: result.messages.length,
                  messages: result.messages,
                  analysis: {
                    rapport: Math.round(result.analysis.rapport * 100),
                    compatibility: Math.round(result.analysis.compatibility * 100),
                    conversationFlow: result.analysis.conversationFlow,
                    sharedInterests: result.analysis.sharedInterests,
                    highlights: result.analysis.highlights,
                  },
                },
                message: `${profile1.name}과 ${profile2.name}의 대화 시뮬레이션이 완료되었습니다.`,
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
                error: err.message || "대화 시뮬레이션 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // analyze_compatibility
  server.tool(
    "analyze_compatibility",
    "두 프로필의 호환성을 AI로 심층 분석합니다. 가치관, 라이프스타일, 소통 방식, 관심사 케미스트리를 평가하고 강점, 도전 과제, 조언을 제공합니다. ANTHROPIC_API_KEY 필요.",
    AnalyzeCompatibilitySchema.shape,
    async ({ profileId1, profileId2 }) => {
      if (!config.claudeApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const [profile1, profile2] = await Promise.all([
          apiClient.getProfile(profileId1),
          apiClient.getProfile(profileId2),
        ]);

        const analysis = await claudeClient.analyzeCompatibility(
          {
            name: profile1.name,
            age: profile1.age,
            values: profile1.values as Record<string, unknown>,
            communicationStyle: profile1.communicationStyle as Record<string, unknown>,
            bio: profile1.bio,
          },
          {
            name: profile2.name,
            age: profile2.age,
            values: profile2.values as Record<string, unknown>,
            communicationStyle: profile2.communicationStyle as Record<string, unknown>,
            bio: profile2.bio,
          }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                compatibility: {
                  profiles: [
                    { id: profileId1, name: profile1.name, age: profile1.age },
                    { id: profileId2, name: profile2.name, age: profile2.age },
                  ],
                  overallScore: Math.round(analysis.overallScore * 100),
                  breakdown: {
                    valuesAlignment: Math.round(analysis.breakdown.valuesAlignment * 100),
                    lifestyleCompatibility: Math.round(analysis.breakdown.lifestyleCompatibility * 100),
                    communicationFit: Math.round(analysis.breakdown.communicationFit * 100),
                    interestChemistry: Math.round(analysis.breakdown.interestChemistry * 100),
                  },
                  strengths: analysis.strengths,
                  challenges: analysis.challenges,
                  advice: analysis.advice,
                },
                message: `${profile1.name}과 ${profile2.name}의 호환성 분석이 완료되었습니다. 전체 점수: ${Math.round(analysis.overallScore * 100)}%`,
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
                error: err.message || "호환성 분석 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // generate_icebreaker
  server.tool(
    "generate_icebreaker",
    "두 프로필을 기반으로 맞춤형 아이스브레이커를 생성합니다. 두 사람의 공통점과 관심사를 고려하여 자연스러운 대화 시작 주제를 추천합니다. ANTHROPIC_API_KEY 필요.",
    GenerateIcebreakerSchema.shape,
    async ({ profileId1, profileId2, context }) => {
      if (!config.claudeApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const [profile1, profile2] = await Promise.all([
          apiClient.getProfile(profileId1),
          apiClient.getProfile(profileId2),
        ]);

        const result = await claudeClient.generateIcebreaker(
          profile1.agentPersona,
          profile2.agentPersona,
          context
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                icebreaker: {
                  participants: [
                    { id: profileId1, name: profile1.name },
                    { id: profileId2, name: profile2.name },
                  ],
                  starter: result.icebreaker,
                  suggestedTopics: result.suggestedTopics,
                  approach: result.approach,
                  context: context || "일반",
                },
                message: `${profile1.name}과 ${profile2.name}을 위한 아이스브레이커가 생성되었습니다.`,
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
                error: err.message || "아이스브레이커 생성 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // suggest_message
  server.tool(
    "suggest_message",
    "상대방에게 보낼 메시지를 AI가 추천합니다. 보내는 사람과 받는 사람의 프로필을 분석하여 자연스러운 메시지를 제안합니다. ANTHROPIC_API_KEY 필요.",
    SuggestMessageSchema.shape,
    async ({ senderProfileId, receiverProfileId, conversationHistory, context }) => {
      if (!config.claudeApiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "ANTHROPIC_API_KEY가 설정되지 않았습니다.",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const [sender, receiver] = await Promise.all([
          apiClient.getProfile(senderProfileId),
          apiClient.getProfile(receiverProfileId),
        ]);

        const result = await claudeClient.suggestMessage(
          sender.agentPersona,
          receiver.agentPersona,
          conversationHistory || [],
          context
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                suggestion: {
                  from: { id: senderProfileId, name: sender.name },
                  to: { id: receiverProfileId, name: receiver.name },
                  recommendedMessage: result.message,
                  alternatives: result.alternatives,
                  context: context || "일반",
                },
                message: `${sender.name}이 ${receiver.name}에게 보낼 메시지 추천이 준비되었습니다.`,
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
                error: err.message || "메시지 추천 실패",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
