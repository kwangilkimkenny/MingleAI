import { AnthropicChatClient } from "./anthropic-chat-client";

const cfg = {
  url: "https://api.anthropic.com",
  apiKey: "sk-ant-test",
  model: "claude-haiku-test",
  timeoutMs: 5000,
  maxTokens: 1024,
};

const reply = (text: string) =>
  ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text }] }) }) as unknown as Response;

afterEach(() => jest.restoreAllMocks());

describe("AnthropicChatClient", () => {
  it("posts to /v1/messages with the api-key and version headers", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(reply("hi"));

    await new AnthropicChatClient(cfg).complete([{ role: "user", content: "안녕" }], { temperature: 0.7 });

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(opts.method).toBe("POST");
    const headers = opts.headers as Record<string, string>;
    // Anthropic은 Bearer가 아니라 x-api-key를 쓰고, 버전 헤더가 없으면 400이다.
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.Authorization).toBeUndefined();
  });

  // OpenAI와 가장 크게 갈리는 지점 — system을 messages에 넣으면 400이 떨어진다.
  it("hoists system messages into the top-level system field", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(reply("hi"));

    await new AnthropicChatClient(cfg).complete(
      [
        { role: "system", content: "너는 도우미다" },
        { role: "user", content: "안녕" },
      ],
      { temperature: 0 },
    );

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.system).toBe("너는 도우미다");
    expect(body.messages).toEqual([{ role: "user", content: "안녕" }]);
    expect(body.messages.some((m: { role: string }) => m.role === "system")).toBe(false);
  });

  it("merges multiple system messages in order", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(reply("hi"));

    await new AnthropicChatClient(cfg).complete(
      [
        { role: "system", content: "첫째" },
        { role: "system", content: "둘째" },
        { role: "user", content: "안녕" },
      ],
      { temperature: 0 },
    );

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.system).toBe("첫째\n\n둘째");
  });

  it("always sends max_tokens (Anthropic rejects the request without it) and the model+temperature", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(reply("hi"));

    await new AnthropicChatClient(cfg).complete([{ role: "user", content: "안녕" }], { temperature: 0 });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.max_tokens).toBe(1024);
    expect(body.model).toBe("claude-haiku-test");
    expect(body.temperature).toBe(0);
    // OpenAI 전용 필드는 실리면 안 된다.
    expect(body).not.toHaveProperty("response_format");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("joins the text blocks of the response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: "text", text: '{"suggestions":' },
          { type: "thinking", thinking: "무시되어야 한다" },
          { type: "text", text: '["하나"]}' },
        ],
      }),
    } as unknown as Response);

    const out = await new AnthropicChatClient(cfg).complete([{ role: "user", content: "x" }], {
      temperature: 0,
    });

    expect(out).toBe('{"suggestions":["하나"]}');
  });

  it("throws on a non-2xx response and on an empty body", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 429 } as Response);
    await expect(
      new AnthropicChatClient(cfg).complete([{ role: "user", content: "x" }], { temperature: 0 }),
    ).rejects.toThrow("LLM 429");

    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ content: [] }) } as unknown as Response);
    await expect(
      new AnthropicChatClient(cfg).complete([{ role: "user", content: "x" }], { temperature: 0 }),
    ).rejects.toThrow("empty LLM content");
  });

  it("does not append a duplicate /v1 when the base url has a trailing slash", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(reply("hi"));

    await new AnthropicChatClient({ ...cfg, url: "https://gw.example.com/anthropic/" }).complete(
      [{ role: "user", content: "x" }],
      { temperature: 0 },
    );

    expect(fetchMock.mock.calls[0][0]).toBe("https://gw.example.com/anthropic/v1/messages");
  });
});
