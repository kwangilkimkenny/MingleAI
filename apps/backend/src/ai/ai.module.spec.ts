import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiModule } from "./ai.module";
import { PREFERENCE_ANALYZER } from "./preference-analyzer.interface";
import { StubPreferenceAnalyzer } from "./stub-preference-analyzer";
import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";

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
    expect(await analyzerWith({ LLM_API_URL: "https://llm.example.com" })).toBeInstanceOf(OpenAICompatPreferenceAnalyzer);
  });
});
