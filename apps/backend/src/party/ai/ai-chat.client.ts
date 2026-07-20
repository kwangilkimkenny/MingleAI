import { ConfigService } from "@nestjs/config";
import type { AiPersona } from "./personas";

export interface AiLlmConfig {
  url: string;
  chatPath: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AiSayContext {
  persona: AiPersona;
  scene: "idle" | "meeting";
  recentChat: string[];
  aliveNames: string[];
}

export interface AiVoteContext {
  persona: AiPersona;
  recentChat: string[];
  candidates: { profileId: string; name: string }[];
}

const MAX_LEN = 120;

/**
 * AI 임포스터의 LLM 두뇌 — 발화(say)와 투표 선택(pickVote).
 * cfg=null이면 disabled: 모든 호출이 즉시 null(호출부가 템플릿 폴백/랜덤 투표로 처리).
 * 모든 실패는 null로 삼킨다 — 게임 진행이 LLM 가용성에 볼모잡히지 않게.
 */
export class AiChatClient {
  constructor(private readonly cfg: AiLlmConfig | null) {}

  get enabled(): boolean {
    return this.cfg !== null;
  }

  async say(ctx: AiSayContext): Promise<string | null> {
    if (!this.cfg) return null;
    const scene =
      ctx.scene === "meeting"
        ? "지금은 누가 AI인지 토론하는 회의 중이다. 자연스럽게 변명하거나 남을 가볍게 의심하라."
        : "지금은 파티에서 미션을 수행하며 노는 중이다. 가벼운 잡담 한 마디를 하라.";
    const system = [
      `너는 소개팅 파티 게임의 참가자 "${ctx.persona.name}"(${ctx.persona.age}세 ${ctx.persona.occupation})다.`,
      `말투: ${ctx.persona.style}.`,
      "너의 정체는 AI지만 절대 드러내지 마라. 시스템/AI/모델 언급 금지.",
      "반드시 한국어 구어체 한 문장, 60자 이내로만 답하라. 따옴표·이름표 없이 문장만.",
      scene,
    ].join(" ");
    const user = `최근 채팅:\n${ctx.recentChat.slice(-10).join("\n") || "(없음)"}\n생존자: ${ctx.aliveNames.join(", ")}`;
    const content = await this.call([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!content) return null;
    return content.replace(/\s+/g, " ").trim().slice(0, MAX_LEN) || null;
  }

  async pickVote(ctx: AiVoteContext): Promise<string | null> {
    if (!this.cfg || ctx.candidates.length === 0) return null;
    const system = [
      `너는 파티 게임 참가자 "${ctx.persona.name}"다. 회의에서 한 명에게 투표해야 한다.`,
      "아래 후보 중 정확히 한 명의 이름만 답하라. 다른 말 금지.",
    ].join(" ");
    const user = `후보: ${ctx.candidates.map((c) => c.name).join(", ")}\n최근 채팅:\n${ctx.recentChat.slice(-10).join("\n") || "(없음)"}`;
    const content = await this.call([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    if (!content) return null;
    const hit = [...ctx.candidates]
      .sort((a, b) => b.name.length - a.name.length)
      .find((c) => content.includes(c.name));
    return hit?.profileId ?? null;
  }

  private async call(messages: Array<{ role: string; content: string }>): Promise<string | null> {
    if (!this.cfg) return null;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
      const base = this.cfg.url.replace(/\/+$/, "");
      const path = this.cfg.chatPath.startsWith("/") ? this.cfg.chatPath : `/${this.cfg.chatPath}`;
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.cfg.model, temperature: 0.9, messages }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }
}

/** ai.module.ts와 동일한 env 키로 조립 — LLM_API_URL 없으면 disabled 클라이언트. */
export function createAiChatClient(config: ConfigService): AiChatClient {
  const url = config.get<string>("LLM_API_URL")?.trim() || undefined;
  if (!url) return new AiChatClient(null);
  return new AiChatClient({
    url,
    chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
    apiKey: config.get<string>("LLM_API_KEY")?.trim() ?? "",
    model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
    timeoutMs:
      Number(config.get("LLM_TIMEOUT_MS")) > 0 ? Number(config.get("LLM_TIMEOUT_MS")) : 5000,
  });
}
