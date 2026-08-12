import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { LlmPreferenceAnalyzer } from "./llm-preference-analyzer";
import { REPLY_SUGGESTER } from "./reply-suggester.interface";
import { LlmReplySuggester } from "./llm-reply-suggester";
import { RuleReplySuggester } from "./rule-reply-suggester";
import type { ChatClient } from "./chat-client";
import { AnthropicChatClient } from "./anthropic-chat-client";
import { OpenAICompatChatClient } from "./openai-compat-chat-client";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com";
/** 우리 용도는 JSON 한 덩이 또는 짧은 문장 3개다 — 넉넉히 잡아도 이 정도면 남는다. */
const DEFAULT_MAX_TOKENS = 1024;

function timeoutMs(config: ConfigService): number {
  const raw = Number(config.get<string>("LLM_TIMEOUT_MS") ?? String(DEFAULT_TIMEOUT_MS));
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * 어떤 LLM으로 갈지 고른다.
 *
 * 우선순위: `ANTHROPIC_API_KEY`가 있으면 **Anthropic**(2026-08-11 기본 경로), 없고
 * `LLM_API_URL`이 있으면 OpenAI 호환(기존 경로 유지), 둘 다 없으면 null → 호출부가
 * 규칙 기반/스텁으로 내려간다. `LLM_PROVIDER`로 명시하면 그 값이 이긴다.
 */
function selectChatClient(config: ConfigService): ChatClient | null {
  const anthropicKey = (config.get<string>("ANTHROPIC_API_KEY") ?? "").trim();
  const openAiUrl = config.get<string>("LLM_API_URL")?.trim() || "";
  const explicit = config.get<string>("LLM_PROVIDER")?.trim().toLowerCase() || "";
  const provider = explicit || (anthropicKey ? "anthropic" : openAiUrl ? "openai" : "");

  if (provider === "anthropic") {
    if (!anthropicKey) return null;
    return new AnthropicChatClient({
      url: config.get<string>("ANTHROPIC_API_URL")?.trim() || DEFAULT_ANTHROPIC_URL,
      apiKey: anthropicKey,
      // 모델 id는 env가 진실이다 — 코드에 박아두면 모델이 바뀔 때마다 배포해야 한다.
      model: config.get<string>("ANTHROPIC_MODEL")?.trim() || "",
      timeoutMs: timeoutMs(config),
      maxTokens: Number(config.get<string>("ANTHROPIC_MAX_TOKENS")) || DEFAULT_MAX_TOKENS,
    });
  }
  if (provider === "openai") {
    if (!openAiUrl) return null;
    return new OpenAICompatChatClient({
      url: openAiUrl,
      chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
      apiKey: (config.get<string>("LLM_API_KEY") ?? "").trim(),
      model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
      timeoutMs: timeoutMs(config),
      reasoningEffort: config.get<string>("LLM_REASONING_EFFORT")?.trim() || undefined,
    });
  }
  return null;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PREFERENCE_ANALYZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = selectChatClient(config);
        return client ? new LlmPreferenceAnalyzer(client) : new StubPreferenceAnalyzer();
      },
    },
    {
      // 답변 추천도 같은 LLM 설정을 쓴다. 미설정이면 규칙 기반 폴백(화면이 빈손이 되지 않게).
      provide: REPLY_SUGGESTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = selectChatClient(config);
        return client ? new LlmReplySuggester(client) : new RuleReplySuggester();
      },
    },
  ],
  exports: [PREFERENCE_ANALYZER, REPLY_SUGGESTER],
})
export class AiModule {}
