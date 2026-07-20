import { AiChatClient } from "./ai-chat.client";

const PERSONA = {
  profileId: "ai-x",
  name: "서지우",
  age: 27,
  gender: "female" as const,
  occupation: "마케터",
  style: "무심한 말투",
};
const CTX = {
  persona: PERSONA,
  scene: "idle" as const,
  recentChat: ["안녕하세요"],
  aliveNames: ["A", "B"],
};

function mockFetchOnce(content: string, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

describe("AiChatClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("url 없으면 disabled — say/pickVote 즉시 null", async () => {
    const c = new AiChatClient(null);
    expect(c.enabled).toBe(false);
    expect(await c.say(CTX)).toBeNull();
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates: [] })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("say — LLM 응답을 120자로 캡해 반환", async () => {
    const c = new AiChatClient({
      url: "http://llm",
      chatPath: "/v1/chat/completions",
      apiKey: "",
      model: "m",
      timeoutMs: 5000,
    });
    mockFetchOnce("가".repeat(300));
    const out = await c.say(CTX);
    expect(out).toHaveLength(120);
  });

  it("say — 네트워크 실패 시 null(예외 없음)", async () => {
    const c = new AiChatClient({
      url: "http://llm",
      chatPath: "/v1/chat/completions",
      apiKey: "",
      model: "m",
      timeoutMs: 5000,
    });
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    expect(await c.say(CTX)).toBeNull();
  });

  it("pickVote — 후보 이름을 답하면 해당 profileId 반환, 엉뚱한 답은 null", async () => {
    const c = new AiChatClient({
      url: "http://llm",
      chatPath: "/v1/chat/completions",
      apiKey: "",
      model: "m",
      timeoutMs: 5000,
    });
    const candidates = [
      { profileId: "p1", name: "유아영" },
      { profileId: "p2", name: "김비준" },
    ];
    mockFetchOnce("김비준");
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates })).toBe("p2");
    mockFetchOnce("모르겠는데요");
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates })).toBeNull();
  });

  it("pickVote — 접두 이름 충돌 시 최장 일치 후보를 고른다", async () => {
    const c = new AiChatClient({
      url: "http://llm",
      chatPath: "/v1/chat/completions",
      apiKey: "",
      model: "m",
      timeoutMs: 5000,
    });
    const candidates = [
      { profileId: "p1", name: "박서" },
      { profileId: "p2", name: "박서준" },
    ];
    mockFetchOnce("박서준이 수상해요");
    expect(await c.pickVote({ persona: PERSONA, recentChat: [], candidates })).toBe("p2");
  });
});
