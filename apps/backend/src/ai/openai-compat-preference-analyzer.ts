import type { PreferenceSignals } from "@mingle/shared";
import { AnalyzeInput, PreferenceAnalyzer, PreferenceAnalysisError } from "./preference-analyzer.interface";
import { parsePreferenceSignals } from "./preference-signals.schema";

export interface OpenAICompatConfig {
  url: string; chatPath: string; apiKey: string; model: string; timeoutMs: number;
}

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

export class OpenAICompatPreferenceAnalyzer implements PreferenceAnalyzer {
  constructor(private readonly cfg: OpenAICompatConfig) {}

  async analyze(input: AnalyzeInput): Promise<PreferenceSignals> {
    const user = `Party preference: "${input.partyPreferenceText}"\nGender: ${input.gender}, Age: ${input.age}, Occupation: ${input.occupation}`;
    const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      let content: string;
      try {
        content = await this.call(attempt === 0 ? messages
          : [...messages, { role: "user", content: "Your previous reply was not valid JSON. Reply with ONLY the JSON object." }]);
      } catch (e) {
        throw new PreferenceAnalysisError("LLM request failed", e); // network/non-2xx: no repair
      }
      try {
        return parsePreferenceSignals(extractJson(content));
      } catch (e) { lastErr = e; } // parse/shape failure → repair retry
    }
    throw new PreferenceAnalysisError("LLM output could not be parsed after repair", lastErr);
  }

  private async call(messages: Array<{ role: string; content: string }>): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    const res = await fetch(`${this.cfg.url}${this.cfg.chatPath}`, {
      method: "POST", headers,
      body: JSON.stringify({ model: this.cfg.model, temperature: 0, response_format: { type: "json_object" }, messages }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty LLM content");
    return content;
  }
}
