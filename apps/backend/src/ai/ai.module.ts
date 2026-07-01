import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";

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
        });
      },
    },
  ],
  exports: [PREFERENCE_ANALYZER],
})
export class AiModule {}
