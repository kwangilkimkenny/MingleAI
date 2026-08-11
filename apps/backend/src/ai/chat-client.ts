/**
 * LLM 호출 seam. 프롬프트와 출력 파싱은 기능(선호분석·답변추천)이 갖고, **HTTP 프로토콜만**
 * 이 뒤로 숨긴다. 그래야 공급자를 바꿔도 실측으로 다듬은 프롬프트를 건드리지 않는다.
 *
 * 구현 둘:
 *  - `OpenAICompatChatClient` — OpenAI 호환 `/v1/chat/completions`(기존 경로, 유지)
 *  - `AnthropicChatClient`    — Anthropic Messages API(2026-08-11 기본 경로로 전환)
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatClient {
  /** 모델의 응답 텍스트. 실패(네트워크·비2xx·빈 응답)는 예외로 던진다. */
  complete(messages: ChatMessage[], opts: { temperature: number }): Promise<string>;
}
