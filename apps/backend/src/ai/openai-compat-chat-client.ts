import type { ChatClient, ChatMessage } from "./chat-client";

export interface OpenAICompatChatConfig {
  url: string;
  chatPath: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** 추론형 모델의 사고량(`none`/`low`/`medium`/`high`). 설정하면 temperature 대신 이 값을 보낸다. */
  reasoningEffort?: string;
}

/**
 * 요청 바디. 추론형 모델(gpt-5.x)은 `temperature` 커스텀 값을 거부하고("Only the default (1)
 * value is supported") 대신 `reasoning_effort`를 받는다 — 그래서 effort가 설정되면 temperature를
 * 빼고 effort를 싣는다. 예전 모델(gpt-4o 등)은 그대로 temperature를 쓴다.
 */
function buildChatBody(
  cfg: { model: string; reasoningEffort?: string },
  messages: Array<{ role: string; content: string }>,
  temperature: number,
): Record<string, unknown> {
  const effort = cfg.reasoningEffort?.trim();
  return {
    model: cfg.model,
    ...(effort ? { reasoning_effort: effort } : { temperature }),
    response_format: { type: "json_object" },
    messages,
  };
}

/** OpenAI 호환 `/v1/chat/completions`. 기존 경로 — Anthropic으로 갈아탄 뒤에도 유지한다. */
export class OpenAICompatChatClient implements ChatClient {
  constructor(private readonly cfg: OpenAICompatChatConfig) {}

  async complete(messages: ChatMessage[], opts: { temperature: number }): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    // base + path를 이을 때 base의 하위 경로(host/api)를 보존하고 슬래시 중복만 없앤다.
    const base = this.cfg.url.replace(/\/+$/, "");
    const path = this.cfg.chatPath.startsWith("/") ? this.cfg.chatPath : `/${this.cfg.chatPath}`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildChatBody(this.cfg, messages, opts.temperature)),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty LLM content");
    return content;
  }
}
