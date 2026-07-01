import { OpenAICompatPreferenceAnalyzer } from "./openai-compat-preference-analyzer";
import { PreferenceAnalysisError } from "./preference-analyzer.interface";

const cfg = {
  url: "https://llm.example.com", chatPath: "/v1/chat/completions",
  apiKey: "k-123", model: "test-model", timeoutMs: 15000,
};
const input = { partyPreferenceText: "조용한 보드게임", gender: "female", age: 27, occupation: "designer" };
const okBody = (content: string) => ({
  ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }),
});

afterEach(() => { (global.fetch as jest.Mock)?.mockReset?.(); });

describe("OpenAICompatPreferenceAnalyzer", () => {
  it("POSTs OpenAI-shaped request and maps the JSON content to signals", async () => {
    const fetchMock = jest.fn().mockResolvedValue(okBody(JSON.stringify({
      vibe: "calm", activity: ["boardgame"], drinking: "none", pace: "slow", tags: ["quiet"], summary: "s",
    })));
    global.fetch = fetchMock as any;
    const a = new OpenAICompatPreferenceAnalyzer(cfg);
    const out = await a.analyze(input);
    expect(out.vibe).toBe("calm");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer k-123");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
  });

  it("omits Authorization when no apiKey", async () => {
    const fetchMock = jest.fn().mockResolvedValue(okBody(JSON.stringify({ vibe: "balanced" })));
    global.fetch = fetchMock as any;
    await new OpenAICompatPreferenceAnalyzer({ ...cfg, apiKey: "" }).analyze(input);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("repairs one malformed (non-JSON) response then succeeds", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(okBody("here you go: not json"))
      .mockResolvedValueOnce(okBody(JSON.stringify({ vibe: "energetic" })));
    global.fetch = fetchMock as any;
    const out = await new OpenAICompatPreferenceAnalyzer(cfg).analyze(input);
    expect(out.vibe).toBe("energetic");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages).toHaveLength(3);
    expect(secondBody.messages[2].role).toBe("user");
  });

  it("throws PreferenceAnalysisError (no retry) when fetch itself rejects", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    global.fetch = fetchMock as any;
    await expect(new OpenAICompatPreferenceAnalyzer(cfg).analyze(input)).rejects.toBeInstanceOf(PreferenceAnalysisError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws PreferenceAnalysisError on non-2xx", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }) as any;
    await expect(new OpenAICompatPreferenceAnalyzer(cfg).analyze(input)).rejects.toBeInstanceOf(PreferenceAnalysisError);
  });

  it("throws PreferenceAnalysisError when both attempts are unparseable", async () => {
    global.fetch = jest.fn().mockResolvedValue(okBody("still not json")) as any;
    await expect(new OpenAICompatPreferenceAnalyzer(cfg).analyze(input)).rejects.toBeInstanceOf(PreferenceAnalysisError);
  });
});
