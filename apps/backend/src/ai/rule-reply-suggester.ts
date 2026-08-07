import { suggestReplies } from "@mingle/shared";
import { ReplySuggester, type SuggestInput } from "./reply-suggester.interface";

/**
 * LLM이 설정되지 않았거나 호출이 실패했을 때의 폴백. `@mingle/shared`의 결정적 규칙 추천기를
 * 그대로 쓴다 — 화면이 빈손으로 끝나지 않게 하는 안전망이다.
 */
export class RuleReplySuggester implements ReplySuggester {
  readonly kind = "rule" as const;

  async suggest(input: SuggestInput): Promise<string[]> {
    return suggestReplies({
      myProfileId: "me",
      messages: input.turns.map((t) => ({
        senderProfileId: t.role === "me" ? "me" : "peer",
        content: t.content,
      })),
    });
  }
}
