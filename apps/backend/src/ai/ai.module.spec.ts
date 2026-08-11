import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiModule } from "./ai.module";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { LlmPreferenceAnalyzer } from "./llm-preference-analyzer";
import { LlmReplySuggester } from "./llm-reply-suggester";
import { RuleReplySuggester } from "./rule-reply-suggester";
import { REPLY_SUGGESTER } from "./reply-suggester.interface";
import { AnthropicChatClient } from "./anthropic-chat-client";
import { OpenAICompatChatClient } from "./openai-compat-chat-client";

async function analyzerWith(env: Record<string, string | undefined>) {
  const moduleRef = await Test.createTestingModule({ imports: [AiModule] })
    .overrideProvider(ConfigService).useValue({ get: (k: string) => env[k] })
    .compile();
  return moduleRef.get(PREFERENCE_ANALYZER);
}

describe("AiModule PREFERENCE_ANALYZER selection", () => {
  it("provides the stub when LLM_API_URL is unset", async () => {
    expect(await analyzerWith({})).toBeInstanceOf(StubPreferenceAnalyzer);
  });
  it("provides the OpenAI-compat analyzer when LLM_API_URL is set", async () => {
    expect(await analyzerWith({ LLM_API_URL: "https://llm.example.com" })).toBeInstanceOf(LlmPreferenceAnalyzer);
  });

  // I1: invalid LLM_TIMEOUT_MS must not throw — clamp to 15000 instead
  it("produces LlmPreferenceAnalyzer even when LLM_TIMEOUT_MS is not a valid number", async () => {
    const analyzer = await analyzerWith({ LLM_API_URL: "https://llm.example.com", LLM_TIMEOUT_MS: "abc" });
    expect(analyzer).toBeInstanceOf(LlmPreferenceAnalyzer);
    // The clamped timeout must be positive so AbortSignal.timeout never RangeErrors
    expect((analyzer as any).client.cfg.timeoutMs).toBe(15000);
  });

  // M7: whitespace-only LLM_API_URL must be treated as unset → StubPreferenceAnalyzer
  it("provides the stub when LLM_API_URL is whitespace-only", async () => {
    expect(await analyzerWith({ LLM_API_URL: "   " })).toBeInstanceOf(StubPreferenceAnalyzer);
  });

  // 2026-08-11: 기본 공급자를 Anthropic으로 옮겼다. OpenAI 경로는 제거하지 않고 남겨 둔다.
  it("prefers Anthropic when ANTHROPIC_API_KEY is set (even if the OpenAI url is also set)", async () => {
    const analyzer = await analyzerWith({
      ANTHROPIC_API_KEY: "sk-ant-x",
      ANTHROPIC_MODEL: "claude-haiku-test",
      LLM_API_URL: "https://llm.example.com",
    });
    expect(analyzer).toBeInstanceOf(LlmPreferenceAnalyzer);
    expect((analyzer as any).client).toBeInstanceOf(AnthropicChatClient);
  });

  it("falls back to the OpenAI-compatible client when only LLM_API_URL is set", async () => {
    const analyzer = await analyzerWith({ LLM_API_URL: "https://llm.example.com" });
    expect((analyzer as any).client).toBeInstanceOf(OpenAICompatChatClient);
  });

  it("honours an explicit LLM_PROVIDER over the auto-detection", async () => {
    const analyzer = await analyzerWith({
      LLM_PROVIDER: "openai",
      ANTHROPIC_API_KEY: "sk-ant-x",
      LLM_API_URL: "https://llm.example.com",
    });
    expect((analyzer as any).client).toBeInstanceOf(OpenAICompatChatClient);
  });

  it("stays on the stub when the provider is named but its credentials are missing", async () => {
    expect(await analyzerWith({ LLM_PROVIDER: "anthropic" })).toBeInstanceOf(StubPreferenceAnalyzer);
  });

  it("passes the Anthropic model and max tokens through from env", async () => {
    const analyzer = await analyzerWith({
      ANTHROPIC_API_KEY: "sk-ant-x",
      ANTHROPIC_MODEL: "claude-haiku-test",
      ANTHROPIC_MAX_TOKENS: "2048",
    });
    const client = (analyzer as any).client;
    expect(client.cfg.model).toBe("claude-haiku-test");
    expect(client.cfg.maxTokens).toBe(2048);
    expect(client.cfg.url).toBe("https://api.anthropic.com");
  });
});

describe("AiModule REPLY_SUGGESTER selection", () => {
  async function suggesterWith(env: Record<string, string | undefined>) {
    const moduleRef = await Test.createTestingModule({ imports: [AiModule] })
      .overrideProvider(ConfigService).useValue({ get: (k: string) => env[k] })
      .compile();
    return moduleRef.get(REPLY_SUGGESTER);
  }

  it("uses the rule-based fallback when no provider is configured", async () => {
    expect(await suggesterWith({})).toBeInstanceOf(RuleReplySuggester);
  });

  it("uses Anthropic when its key is present", async () => {
    const suggester = await suggesterWith({ ANTHROPIC_API_KEY: "sk-ant-x", ANTHROPIC_MODEL: "m" });
    expect(suggester).toBeInstanceOf(LlmReplySuggester);
    expect((suggester as any).client).toBeInstanceOf(AnthropicChatClient);
  });
});