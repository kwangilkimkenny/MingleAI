export const REPLY_SUGGESTER = Symbol("REPLY_SUGGESTER");

export interface SuggestTurn {
  /** "me" = 추천을 받는 사람, "peer" = 상대. 실명·profileId는 LLM에 보내지 않는다. */
  role: "me" | "peer";
  content: string;
}

export interface SuggestInput {
  /** 오래된 것 → 최신 순. 호출부가 최근 것만 잘라서 넘긴다. */
  turns: SuggestTurn[];
}

export interface ReplySuggester {
  /** 응답의 출처를 화면에 정직하게 표시하기 위한 구분 — LLM인지 규칙 폴백인지. */
  readonly kind: "ai" | "rule";
  /** 이어서 보낼 만한 한국어 문장 3개. 실패하면 예외를 던져 호출부가 폴백하게 한다. */
  suggest(input: SuggestInput): Promise<string[]>;
}

export class ReplySuggestionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ReplySuggestionError";
  }
}
