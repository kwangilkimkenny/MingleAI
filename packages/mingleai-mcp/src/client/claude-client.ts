/**
 * Claude API 클라이언트
 * 에이전트 대화 시뮬레이션 및 분석에 사용
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export interface ConversationMessage {
  role: "agent1" | "agent2";
  agentName: string;
  content: string;
  sentiment?: "positive" | "neutral" | "negative";
  topics?: string[];
}

export interface ConversationResult {
  messages: ConversationMessage[];
  analysis: {
    rapport: number;
    sharedInterests: string[];
    conversationFlow: "natural" | "awkward" | "engaging";
    compatibility: number;
    highlights: string[];
  };
}

export interface IcebreakerResult {
  icebreaker: string;
  suggestedTopics: string[];
  approach: "casual" | "deep" | "playful";
}

export interface CompatibilityAnalysis {
  overallScore: number;
  breakdown: {
    valuesAlignment: number;
    lifestyleCompatibility: number;
    communicationFit: number;
    interestChemistry: number;
  };
  strengths: string[];
  challenges: string[];
  advice: string;
}

export class ClaudeClient {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!config.claudeApiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요."
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: config.claudeApiKey });
    }
    return this.client;
  }

  /**
   * 두 에이전트 간 대화 시뮬레이션
   */
  async simulateConversation(
    agent1Persona: string,
    agent1Name: string,
    agent2Persona: string,
    agent2Name: string,
    icebreaker: string,
    topics: string[],
    messageCount: number = 6
  ): Promise<ConversationResult> {
    const client = this.getClient();

    const systemPrompt = `당신은 두 AI 에이전트 간의 소셜 매칭 대화를 시뮬레이션합니다.

## 에이전트 1: ${agent1Name}
${agent1Persona}

## 에이전트 2: ${agent2Name}
${agent2Persona}

## 대화 규칙
1. 각 에이전트의 페르소나에 충실하게 대화하세요
2. 자연스럽고 진정성 있는 대화를 만드세요
3. 실제 전화번호, 주소, 금융정보 등 민감한 정보는 절대 포함하지 마세요
4. 상대방의 관심사에 대해 질문하고 공감하세요
5. 대화는 한국어로 진행됩니다

## 출력 형식
JSON 형식으로 출력하세요:
{
  "messages": [
    {"role": "agent1", "agentName": "${agent1Name}", "content": "메시지", "sentiment": "positive|neutral|negative", "topics": ["주제1"]},
    {"role": "agent2", "agentName": "${agent2Name}", "content": "메시지", "sentiment": "positive|neutral|negative", "topics": ["주제2"]}
  ],
  "analysis": {
    "rapport": 0.0-1.0,
    "sharedInterests": ["공통 관심사"],
    "conversationFlow": "natural|awkward|engaging",
    "compatibility": 0.0-1.0,
    "highlights": ["대화 하이라이트"]
  }
}`;

    const userPrompt = `아이스브레이커: "${icebreaker}"
추천 대화 주제: ${topics.join(", ")}

위 상황에서 ${messageCount}개의 메시지로 대화를 시뮬레이션하세요. ${agent1Name}이 먼저 시작합니다.
JSON 형식으로만 응답하세요.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    try {
      // JSON 파싱 (마크다운 코드 블록 제거)
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      return JSON.parse(jsonText.trim()) as ConversationResult;
    } catch {
      // 파싱 실패 시 기본 응답
      return {
        messages: [
          {
            role: "agent1",
            agentName: agent1Name,
            content: "안녕하세요! 반갑습니다.",
            sentiment: "positive",
            topics: ["인사"],
          },
          {
            role: "agent2",
            agentName: agent2Name,
            content: "안녕하세요! 저도 반가워요.",
            sentiment: "positive",
            topics: ["인사"],
          },
        ],
        analysis: {
          rapport: 0.5,
          sharedInterests: [],
          conversationFlow: "natural",
          compatibility: 0.5,
          highlights: ["첫 인사 교환"],
        },
      };
    }
  }

  /**
   * 맞춤형 아이스브레이커 생성
   */
  async generateIcebreaker(
    agent1Persona: string,
    agent2Persona: string,
    context?: string
  ): Promise<IcebreakerResult> {
    const client = this.getClient();

    const prompt = `두 사람의 첫 만남을 위한 아이스브레이커를 생성하세요.

## 사람 1 프로필
${agent1Persona}

## 사람 2 프로필
${agent2Persona}

${context ? `## 상황\n${context}` : ""}

## 출력 형식 (JSON)
{
  "icebreaker": "두 사람 모두에게 흥미로운 대화 시작 질문이나 화제",
  "suggestedTopics": ["후속 대화 주제 3-5개"],
  "approach": "casual|deep|playful"
}

두 사람의 공통점과 관심사를 고려하여 자연스러운 아이스브레이커를 만드세요.
JSON 형식으로만 응답하세요.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    try {
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
      return JSON.parse(jsonText.trim()) as IcebreakerResult;
    } catch {
      return {
        icebreaker: "요즘 가장 관심 있는 것은 무엇인가요?",
        suggestedTopics: ["취미", "여행", "일상"],
        approach: "casual",
      };
    }
  }

  /**
   * 두 프로필의 호환성 심층 분석
   */
  async analyzeCompatibility(
    profile1: {
      name: string;
      age: number;
      values: Record<string, unknown>;
      communicationStyle: Record<string, unknown>;
      bio?: string;
    },
    profile2: {
      name: string;
      age: number;
      values: Record<string, unknown>;
      communicationStyle: Record<string, unknown>;
      bio?: string;
    }
  ): Promise<CompatibilityAnalysis> {
    const client = this.getClient();

    const prompt = `두 사람의 매칭 호환성을 분석하세요.

## ${profile1.name} (${profile1.age}세)
- 가치관: ${JSON.stringify(profile1.values)}
- 소통 스타일: ${JSON.stringify(profile1.communicationStyle)}
${profile1.bio ? `- 자기소개: ${profile1.bio}` : ""}

## ${profile2.name} (${profile2.age}세)
- 가치관: ${JSON.stringify(profile2.values)}
- 소통 스타일: ${JSON.stringify(profile2.communicationStyle)}
${profile2.bio ? `- 자기소개: ${profile2.bio}` : ""}

## 출력 형식 (JSON)
{
  "overallScore": 0.0-1.0,
  "breakdown": {
    "valuesAlignment": 0.0-1.0,
    "lifestyleCompatibility": 0.0-1.0,
    "communicationFit": 0.0-1.0,
    "interestChemistry": 0.0-1.0
  },
  "strengths": ["두 사람의 강점 2-3개"],
  "challenges": ["잠재적 도전 1-2개"],
  "advice": "관계 발전을 위한 조언"
}

현실적이고 균형 잡힌 분석을 제공하세요. JSON 형식으로만 응답하세요.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    try {
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
      return JSON.parse(jsonText.trim()) as CompatibilityAnalysis;
    } catch {
      return {
        overallScore: 0.5,
        breakdown: {
          valuesAlignment: 0.5,
          lifestyleCompatibility: 0.5,
          communicationFit: 0.5,
          interestChemistry: 0.5,
        },
        strengths: ["분석 불가"],
        challenges: ["분석 불가"],
        advice: "더 많은 대화를 통해 서로를 알아가세요.",
      };
    }
  }

  /**
   * 대화 메시지 추천
   */
  async suggestMessage(
    senderPersona: string,
    receiverPersona: string,
    conversationHistory: string[],
    context?: string
  ): Promise<{ message: string; alternatives: string[] }> {
    const client = this.getClient();

    const historyText =
      conversationHistory.length > 0
        ? `이전 대화:\n${conversationHistory.join("\n")}`
        : "첫 메시지입니다.";

    const prompt = `상대방에게 보낼 메시지를 추천하세요.

## 보내는 사람
${senderPersona}

## 받는 사람
${receiverPersona}

## 대화 기록
${historyText}

${context ? `## 상황: ${context}` : ""}

## 출력 형식 (JSON)
{
  "message": "추천 메시지",
  "alternatives": ["대안 메시지 2개"]
}

자연스럽고 진정성 있는 메시지를 추천하세요. JSON 형식으로만 응답하세요.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    try {
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
      return JSON.parse(jsonText.trim());
    } catch {
      return {
        message: "안녕하세요! 프로필을 보고 연락드려요.",
        alternatives: [
          "반가워요! 대화 나눠볼까요?",
          "안녕하세요, 관심사가 비슷한 것 같아서요.",
        ],
      };
    }
  }
}

// 싱글톤 인스턴스
export const claudeClient = new ClaudeClient();
