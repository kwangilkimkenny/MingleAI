import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";
import { REPLY_SUGGESTER } from "./reply-suggester.interface";
import { OpenAICompatReplySuggester } from "./openai-compat-reply-suggester";
import { RuleReplySuggester } from "./rule-reply-suggester";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PREFERENCE_ANALYZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("LLM_API_URL")?.trim() || undefined;
        if (!url) return new StubPreferenceAnalyzer();
        const t = Number(config.get<string>("LLM_TIMEOUT_MS") ?? "15000");
        const timeoutMs = Number.isInteger(t) && t > 0 ? t : 15000;
        return new OpenAICompatPreferenceAnalyzer({
          url,
          chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
          apiKey: (config.get<string>("LLM_API_KEY") ?? "").trim(),
          model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
          timeoutMs,
          reasoningEffort: config.get<string>("LLM_REASONING_EFFORT")?.trim() || undefined,
        });
      },
    },
    {
      // 답변 추천도 같은 LLM 설정을 쓴다. 미설정이면 규칙 기반 폴백(화면이 빈손이 되지 않게).
      provide: REPLY_SUGGESTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("LLM_API_URL")?.trim() || undefined;
        if (!url) return new RuleReplySuggester();
        const t = Number(config.get<string>("LLM_TIMEOUT_MS") ?? "15000");
        const timeoutMs = Number.isInteger(t) && t > 0 ? t : 15000;
        return new OpenAICompatReplySuggester({
          url,
          chatPath: config.get<string>("LLM_CHAT_PATH") ?? "/v1/chat/completions",
          apiKey: (config.get<string>("LLM_API_KEY") ?? "").trim(),
          model: config.get<string>("LLM_MODEL") ?? "gpt-4o-mini",
          timeoutMs,
          reasoningEffort: config.get<string>("LLM_REASONING_EFFORT")?.trim() || undefined,
        });
      },
    },
  ],
  exports: [PREFERENCE_ANALYZER, REPLY_SUGGESTER],
})
export class AiModule {}
