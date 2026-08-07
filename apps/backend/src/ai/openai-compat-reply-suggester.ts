import {
  ReplySuggester,
  ReplySuggestionError,
  type SuggestInput,
} from "./reply-suggester.interface";

export interface OpenAICompatReplyConfig {
  url: string;
  chatPath: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** 추론형 모델의 사고량(`none`/`low`/`medium`/`high`). 설정하면 그대로 전달한다. */
  reasoningEffort?: string;
}

/**
 * 화자 귀속이 이 프롬프트의 핵심이다. 대화록만 던지면 모델이 **내가 말한 사실을 상대의 것으로
 * 착각해** 되묻는다("저는 클라이밍 다녀요" → "클라이밍 좋아하시나 봐요"). 실측으로 잡은 조합:
 * ①`나:`/`상대:` 줄의 의미를 못 박고 ②되묻기 금지를 잘못된 예와 함께 보여주고 ③마지막 줄의
 * 화자를 따로 알려준다. 이 셋을 갖추면 4개 시나리오 ×3회에서 귀속 오류 0이었다(2026-08-07).
 */
const SYSTEM = [
  "너는 한국어 소개팅 앱에서 사용자가 다음에 보낼 메시지를 제안하는 도우미다.",
  "대화 흐름을 읽고, 사용자가 그대로 보내거나 조금 고쳐 쓸 수 있는 자연스러운 한국어 문장 3개를 제안한다.",
  '대화 기록에서 "나:"로 시작하는 줄은 사용자가 이미 보낸 말이고, "상대:"는 상대가 보낸 말이다.',
  "내가 말한 사실(취미·직업·경험)은 내 정보다 — 그걸 상대의 것으로 착각해 되묻지 마라.",
  '예: 내가 "저는 등산을 좋아해요"라고 했다면 "등산 좋아하시나 봐요"는 틀린 제안이다. "다음에 같이 가실래요?"처럼 내 말에서 이어가야 한다.',
  '오직 JSON 객체 하나로만 답한다: {"suggestions":["문장1","문장2","문장3"]}',
  "각 문장은 40자 이내, 존댓말, 이모지 없이. 서로 다른 방향이어야 한다(예: 되묻기 / 공감 / 새 화제).",
  "상대를 압박하거나 개인정보(전화번호·주소·직장 위치)를 묻는 문장, 성적·차별적 표현은 절대 넣지 않는다.",
  "마지막 발화가 상대의 질문이면 답을 이어갈 수 있는 문장을 우선 제안한다.",
].join(" ");

function extractSuggestions(content: string): string[] {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object in content");
  const parsed = JSON.parse(content.slice(start, end + 1)) as { suggestions?: unknown };
  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  const cleaned = list
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.length > 0 && s.length <= 120);
  const unique = [...new Set(cleaned)];
  if (unique.length === 0) throw new Error("no usable suggestions");
  return unique.slice(0, 3);
}

/**
 * OpenAI 호환 chat completions로 다음 멘트를 제안한다(LLM_API_URL 계열 env를 공유).
 *
 * 프라이버시: 최근 대화 몇 줄만 role(me/peer)로 익명화해 보낸다 — 이름·profileId·연락처는
 * 프롬프트에 넣지 않는다. 실패하면 예외를 던지고, 호출부가 규칙 기반 폴백으로 내려간다.
 */
export class OpenAICompatReplySuggester implements ReplySuggester {
  readonly kind = "ai" as const;

  constructor(private readonly cfg: OpenAICompatReplyConfig) {}

  async suggest(input: SuggestInput): Promise<string[]> {
    const transcript = input.turns
      .map((t) => `${t.role === "me" ? "나" : "상대"}: ${t.content}`)
      .join("\n");
    // 마지막 화자를 따로 알려 준다 — 대화록만으로는 모델이 마지막 발화를 상대 것으로 가정한다.
    const lastWho = input.turns.length
      ? input.turns[input.turns.length - 1].role === "me"
        ? "나"
        : "상대"
      : null;
    const user = transcript
      ? `대화 기록:\n${transcript}\n\n마지막 줄은 "${lastWho}"가 보냈다. 내가 다음에 보낼 문장 3개를 제안해.`
      : "아직 대화가 없다. 내가 먼저 건넬 첫 문장 3개를 제안해.";

    let content: string;
    try {
      content = await this.call([
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ]);
    } catch (e) {
      throw new ReplySuggestionError("LLM request failed", e);
    }
    try {
      return extractSuggestions(content);
    } catch (e) {
      throw new ReplySuggestionError("LLM output could not be parsed", e);
    }
  }

  private async call(messages: Array<{ role: string; content: string }>): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    const base = this.cfg.url.replace(/\/+$/, "");
    const path = this.cfg.chatPath.startsWith("/") ? this.cfg.chatPath : `/${this.cfg.chatPath}`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildChatBody(this.cfg, messages, 0.7)),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty LLM content");
    return content;
  }
}

/**
 * 요청 바디. 추론형 모델(gpt-5.x)은 `temperature` 커스텀 값을 거부하고("Only the default (1)
 * value is supported") 대신 `reasoning_effort`를 받는다 — 그래서 effort가 설정되면 temperature를
 * 빼고 effort를 싣는다. 예전 모델(gpt-4o 등)은 그대로 temperature를 쓴다.
 */
export function buildChatBody(
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
