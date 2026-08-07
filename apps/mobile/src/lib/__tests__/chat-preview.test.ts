import { describe, it, expect } from "vitest";
import { messagePreview } from "../chat-preview";

describe("messagePreview", () => {
  it("shows the text when there is one", () => {
    expect(messagePreview({ content: "안녕하세요" })).toBe("안녕하세요");
  });

  it("labels a photo-only message instead of leaving the row blank", () => {
    expect(messagePreview({ content: "", imageUrl: "/uploads/a.jpg" })).toBe("사진");
  });

  it("shows both when a photo has a caption", () => {
    expect(messagePreview({ content: "여기 좋아요", imageUrl: "/uploads/a.jpg" })).toBe(
      "사진 · 여기 좋아요",
    );
  });

  it("collapses whitespace so a multi-line message stays on one row", () => {
    expect(messagePreview({ content: "  줄이\n여러\t개  " })).toBe("줄이 여러 개");
  });

  it("falls back for an empty room or an empty message with no photo", () => {
    expect(messagePreview(null)).toBe("새로운 대화를 시작해 보세요");
    expect(messagePreview({ content: "   " })).toBe("새로운 대화를 시작해 보세요");
  });
});
