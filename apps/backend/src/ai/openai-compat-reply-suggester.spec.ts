import { OpenAICompatReplySuggester } from "./openai-compat-reply-suggester";
import { ReplySuggestionError } from "./reply-suggester.interface";

const cfg = {
  url: "https://llm.test",
  chatPath: "/v1/chat/completions",
  apiKey: "key",
  model: "m",
  timeoutMs: 5000,
};

function reply(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

afterEach(() => jest.restoreAllMocks());

it("parses the suggestion list and caps it at three", async () => {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(reply('{"suggestions":["하나","둘","셋","넷"]}'));
  const out = await new OpenAICompatReplySuggester(cfg).suggest({
    turns: [{ role: "peer", content: "안녕하세요" }],
  });
  expect(out).toEqual(["하나", "둘", "셋"]);
});

it("tolerates prose around the JSON and drops duplicates and blanks", async () => {
  jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(reply('네, 여기 있습니다: {"suggestions":["하나","하나","  ","둘"]} 이상입니다'));
  const out = await new OpenAICompatReplySuggester(cfg).suggest({ turns: [] });
  expect(out).toEqual(["하나", "둘"]);
});

it("names the last speaker so the model does not misattribute my own facts", async () => {
  const fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(reply('{"suggestions":["하나"]}'));
  await new OpenAICompatReplySuggester(cfg).suggest({
    turns: [
      { role: "peer", content: "주말에 뭐 하세요?" },
      { role: "me", content: "저는 클라이밍 다녀요" },
    ],
  });
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  const prompt = body.messages.map((m: { content: string }) => m.content).join("\n");
  expect(prompt).toContain('마지막 줄은 "나"가 보냈다');
  // 내가 말한 사실을 상대에게 되묻지 말라는 규칙이 반드시 실려야 한다(2026-08-07 귀속 버그).
  expect(prompt).toContain("되묻지 마라");
});

it("marks the peer as the last speaker when they spoke last", async () => {
  const fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(reply('{"suggestions":["하나"]}'));
  await new OpenAICompatReplySuggester(cfg).suggest({
    turns: [
      { role: "me", content: "안녕하세요" },
      { role: "peer", content: "반가워요" },
    ],
  });
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  const prompt = body.messages.map((m: { content: string }) => m.content).join("\n");
  expect(prompt).toContain('마지막 줄은 "상대"가 보냈다');
});

it("sends only role-tagged turns — no names or ids in the prompt", async () => {
  const fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(reply('{"suggestions":["하나"]}'));
  await new OpenAICompatReplySuggester(cfg).suggest({
    turns: [
      { role: "peer", content: "안녕하세요" },
      { role: "me", content: "반가워요" },
    ],
  });
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  const prompt = body.messages.map((m: { content: string }) => m.content).join("\n");
  expect(prompt).toContain("상대: 안녕하세요");
  expect(prompt).toContain("나: 반가워요");
  expect(body.response_format).toEqual({ type: "json_object" });
});

it("raises a typed error on a non-2xx response", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503 } as Response);
  await expect(
    new OpenAICompatReplySuggester(cfg).suggest({ turns: [] }),
  ).rejects.toBeInstanceOf(ReplySuggestionError);
});

it("raises a typed error when the model answers with no usable list", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(reply('{"suggestions":[]}'));
  await expect(
    new OpenAICompatReplySuggester(cfg).suggest({ turns: [] }),
  ).rejects.toBeInstanceOf(ReplySuggestionError);
});

describe("추론형 모델 파라미터", () => {
  it("reasoning effort를 주면 temperature 대신 reasoning_effort를 보낸다", async () => {
    // gpt-5.x는 temperature 커스텀 값을 거부한다("Only the default (1) value is supported").
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply('{"suggestions":["하나"]}'));
    await new OpenAICompatReplySuggester({
      ...cfg,
      model: "gpt-5.6-luna",
      reasoningEffort: "none",
    }).suggest({ turns: [] });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.reasoning_effort).toBe("none");
    expect(body).not.toHaveProperty("temperature");
  });

  it("effort가 없으면 예전대로 temperature를 보낸다", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply('{"suggestions":["하나"]}'));
    await new OpenAICompatReplySuggester(cfg).suggest({ turns: [] });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.temperature).toBe(0.7);
    expect(body).not.toHaveProperty("reasoning_effort");
  });
});
