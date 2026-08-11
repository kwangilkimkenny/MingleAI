import type { PreferenceSignals } from "@mingle/shared";
import { AnalyzeInput, PreferenceAnalyzer, PreferenceAnalysisError } from "./preference-analyzer.interface";
import { parsePreferenceSignals } from "./preference-signals.schema";
import type { ChatClient } from "./chat-client";

const SYSTEM = [
  "You convert a person's free-text party preference into a compact JSON object.",
  "Respond with ONLY a JSON object, no prose, matching exactly this shape:",
  `{"vibe":"calm|energetic|balanced","activity":string[],"drinking":"none|light|social","pace":"slow|medium|fast","tags":string[],"summary":string}`,
  "vibe=overall mood; drinking=alcohol appetite; pace=how fast they want to get close; tags=lowercase keywords for similarity (<=10); summary<=120 chars.",
].join(" ");

// Heuristic: slice from first `{` to last `}`. A trailing spurious `}` can defeat this,
// producing invalid JSON — which harmlessly triggers the repair retry.
function extractJson(content: string): unknown {
  const s = content.indexOf("{"), e = content.lastIndexOf("}");
  if (s === -1 || e === -1 || e < s) throw new Error("no JSON object in content");
  return JSON.parse(content.slice(s, e + 1));
}

/**
 * 자유서술 선호를 매칭 신호 JSON으로 바꾼다. 공급자(Anthropic / OpenAI 호환)는 `ChatClient`
 * 뒤에 있고, 이 클래스는 프롬프트·파싱·복구 재시도만 책임진다.
 */
export class LlmPreferenceAnalyzer implements PreferenceAnalyzer {
  constructor(private readonly client: ChatClient) {}

  async analyze(input: AnalyzeInput): Promise<PreferenceSignals> {
    const user = `Party preference: ${JSON.stringify(input.partyPreferenceText)}\nGender: ${JSON.stringify(input.gender)}, Age: ${input.age}, Occupation: ${JSON.stringify(input.occupation)}`;
    const messages = [
      { role: "system" as const, content: SYSTEM },
      { role: "user" as const, content: user },
    ];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      let content: string;
      try {
        content = await this.client.complete(
          attempt === 0
            ? messages
            : [...messages, { role: "user" as const, content: `Your previous reply could not be parsed (${(lastErr as Error)?.message ?? "invalid"}). Reply with ONLY the JSON object matching the schema.` }],
          { temperature: 0 },
        );
      } catch (e) {
        throw new PreferenceAnalysisError("LLM request failed", e); // network/non-2xx: no repair
      }
      try {
        return parsePreferenceSignals(extractJson(content));
      } catch (e) { lastErr = e; } // parse/shape failure → repair retry
    }
    throw new PreferenceAnalysisError("LLM output could not be parsed after repair", lastErr);
  }
}
