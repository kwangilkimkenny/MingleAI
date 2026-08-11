import type { ChatClient, ChatMessage } from "./chat-client";

export interface AnthropicConfig {
  /** 기본 https://api.anthropic.com */
  url: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** 응답 상한. 우리 용도(JSON 한 덩이·문장 3개)엔 1024면 충분하다. */
  maxTokens: number;
}

/** Anthropic이 요구하는 API 버전 헤더. 값이 바뀌면 응답 스키마가 바뀔 수 있다. */
const API_VERSION = "2023-06-01";

/**
 * Anthropic Messages API 클라이언트.
 *
 * OpenAI와 다른 점 셋 — 이게 이 파일이 존재하는 이유다:
 *  1. `system`은 메시지 배열이 아니라 **최상위 필드**다. system role을 messages에 넣으면 400.
 *  2. `max_tokens`가 **필수**다.
 *  3. 응답이 `choices[0].message.content`가 아니라 `content[]`의 text 블록들이다.
 *
 * JSON 강제(`response_format`)는 없다. 프롬프트가 "JSON 객체 하나만"을 지시하고, 파서가
 * 첫 `{`부터 마지막 `}`까지 잘라내므로 앞뒤 군말이 붙어도 견딘다.
 */
export class AnthropicChatClient implements ChatClient {
  constructor(private readonly cfg: AnthropicConfig) {}

  async complete(messages: ChatMessage[], opts: { temperature: number }): Promise<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const base = this.cfg.url.replace(/\/+$/, "");
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.cfg.apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: this.cfg.model,
        max_tokens: this.cfg.maxTokens,
        temperature: opts.temperature,
        ...(system ? { system } : {}),
        messages: turns,
      }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);

    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    if (!text) throw new Error("empty LLM content");
    return text;
  }
}
