import { describe, it, expect } from "vitest";
import { suggestReplies, type SuggestMessage } from "./suggest.js";

const ME = "me";
const YOU = "you";
const from = (senderProfileId: string, content: string): SuggestMessage => ({ senderProfileId, content });

describe("suggestReplies", () => {
  it("always returns three distinct non-empty lines, even with no history", () => {
    const out = suggestReplies({ messages: [], myProfileId: ME });
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    expect(out.every((s) => s.length > 0)).toBe(true);
  });

  it("is deterministic for the same conversation", () => {
    const messages = [from(YOU, "안녕하세요!"), from(ME, "반가워요")];
    expect(suggestReplies({ messages, myProfileId: ME })).toEqual(
      suggestReplies({ messages, myProfileId: ME }),
    );
  });

  it("leads with an answer-shaped line when the peer just asked something", () => {
    const out = suggestReplies({
      messages: [from(ME, "안녕하세요"), from(YOU, "주말에 보통 뭐 하세요?")],
      myProfileId: ME,
    });
    expect(out[0]).toMatch(/질문/);
  });

  it("follows the topic the peer raised", () => {
    const out = suggestReplies({
      messages: [from(ME, "안녕하세요"), from(YOU, "저는 여행 다니는 걸 좋아해요")],
      myProfileId: ME,
    });
    expect(out.some((s) => s.includes("여행"))).toBe(true);
  });

  it("keeps to a single topic so the three lines do not scatter", () => {
    const out = suggestReplies({
      messages: [from(YOU, "영화도 좋아하고 운동도 좋아해요")],
      myProfileId: ME,
    });
    const movie = out.filter((s) => /작품|장르/.test(s)).length;
    const sport = out.filter((s) => /운동/.test(s)).length;
    expect(movie === 0 || sport === 0).toBe(true);
  });

  it("offers to meet once the conversation has some depth", () => {
    const messages = Array.from({ length: 8 }, (_, i) =>
      from(i % 2 === 0 ? ME : YOU, `메시지 ${i}`),
    );
    const out = suggestReplies({ messages, myProfileId: ME });
    expect(out.some((s) => /만나|커피/.test(s))).toBe(true);
  });

  it("does not suggest meeting in the first few messages", () => {
    const out = suggestReplies({ messages: [from(YOU, "안녕하세요")], myProfileId: ME });
    expect(out.some((s) => /만나볼래요|커피 한 잔부터/.test(s))).toBe(false);
  });

  it("only reads the recent tail, so an old topic does not haunt the thread", () => {
    const old = Array.from({ length: 20 }, () => from(YOU, "여행 얘기"));
    const fresh = Array.from({ length: 12 }, () => from(YOU, "요즘 운동 시작했어요"));
    const out = suggestReplies({ messages: [...old, ...fresh], myProfileId: ME });
    expect(out.some((s) => s.includes("여행"))).toBe(false);
  });

  it("treats a question from myself as no question at all", () => {
    const out = suggestReplies({ messages: [from(ME, "주말에 뭐 해요?")], myProfileId: ME });
    expect(out[0]).not.toMatch(/질문/);
  });
});
