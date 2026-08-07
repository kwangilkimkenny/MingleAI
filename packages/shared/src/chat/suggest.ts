/**
 * 다음 멘트 추천 — 방금 나눈 대화를 읽고 이어 보낼 만한 문장 3개를 만든다(2026-08-06).
 *
 * 왜 규칙 기반인가: 이 앱의 AI 경계는 "사용자 대신 대화하지 않는다"이다. 문장을 생성해 자동으로
 * 보내는 게 아니라 **입력창을 채워 주는** 힌트이고, 사용자가 지우거나 고쳐 쓴다. 그래서 서버
 * 왕복도 LLM도 없이 결정적으로 만든다 — 같은 대화에는 같은 추천이 나오고, 테스트로 고정된다.
 *
 * 추천 순서(먼저 걸리는 규칙이 앞자리):
 *  1) 상대가 방금 질문했다 → 답을 미루지 않게 되묻기·공감으로 이어 준다
 *  2) 최근 대화에 화제 키워드가 있다 → 그 화제를 파고드는 후속 질문
 *  3) 대화가 충분히 오갔다 → 만남으로 옮겨 가는 제안
 *  4) 아직 초반이거나 내가 마지막으로 말했다 → 부담 없는 새 화제
 */

export interface SuggestMessage {
  /** 이 메시지를 보낸 사람의 profileId. */
  senderProfileId: string;
  content: string;
}

export interface SuggestRepliesInput {
  /** 오래된 것 → 최신 순. 최근 12개만 본다. */
  messages: SuggestMessage[];
  /** 나(추천을 받는 사람)의 profileId. */
  myProfileId: string;
  /** 상대 이름 — 문장에 자연스럽게 넣을 수 있을 때만 쓴다. */
  peerName?: string;
}

/** 화제 키워드 → 이어 붙일 질문. 위에 있을수록 우선. */
const TOPICS: { keywords: string[]; replies: string[] }[] = [
  {
    keywords: ["여행", "여행지", "해외", "제주", "휴가"],
    replies: [
      "여행 얘기 좋아요. 최근에 다녀온 곳 중에 제일 좋았던 데는 어디예요?",
      "다음에 가보고 싶은 여행지가 있어요?",
    ],
  },
  {
    keywords: ["영화", "드라마", "넷플릭스", "시리즈"],
    replies: [
      "요즘 본 것 중에 제일 재밌었던 작품은 뭐예요?",
      "저도 그 장르 좋아해요. 인생 작품 하나만 꼽는다면요?",
    ],
  },
  {
    keywords: ["음식", "맛집", "먹", "food", "밥", "요리", "카페", "커피"],
    replies: [
      "그 얘기 들으니 배고파지네요. 요즘 제일 자주 가는 데는 어디예요?",
      "혹시 못 먹는 음식 있어요? 나중에 참고하려고요.",
    ],
  },
  {
    keywords: ["운동", "헬스", "러닝", "등산", "요가", "클라이밍"],
    replies: [
      "운동 꾸준히 하시는구나. 얼마나 자주 하세요?",
      "저도 같이 해보고 싶네요. 초보도 따라갈 만해요?",
    ],
  },
  {
    keywords: ["일", "회사", "직장", "업무", "출근", "야근"],
    replies: [
      "요즘 일은 좀 어때요? 바쁜 시기예요?",
      "일 끝나고는 보통 뭐 하면서 쉬어요?",
    ],
  },
  {
    keywords: ["음악", "노래", "공연", "콘서트", "플레이리스트"],
    replies: [
      "요즘 제일 많이 듣는 노래가 뭐예요?",
      "공연 보러 다니는 것도 좋아해요?",
    ],
  },
  {
    keywords: ["주말", "휴일", "쉬는 날", "연휴"],
    replies: [
      "주말엔 보통 어떻게 보내요?",
      "이번 주말에는 뭐 하기로 했어요?",
    ],
  },
  {
    keywords: ["강아지", "고양이", "반려", "댕댕", "냥"],
    replies: [
      "반려동물 얘기 반가워요. 같이 산 지는 얼마나 됐어요?",
      "사진 있으면 나중에 보여줘요.",
    ],
  },
];

/** 상대가 질문을 던졌을 때 쓸 문장. */
const AFTER_QUESTION = [
  "좋은 질문이네요. 저는 이런 편이에요 — ",
  "생각해 본 적 있어요. 답하기 전에, 그쪽은 어때요?",
  "재밌는 질문이에요. 왜 궁금했어요?",
];

/** 대화가 무르익었을 때 만남으로 옮기는 문장. */
const MEETUP = [
  "얘기 나눠보니 잘 맞는 것 같아요. 이번 주말에 짧게 만나볼래요?",
  "이런 얘기는 만나서 하면 더 재밌겠어요. 편한 요일 있어요?",
  "가볍게 커피 한 잔부터 어때요?",
];

/** 초반·화제가 끊겼을 때의 안전한 새 화제. */
const OPENERS = [
  "오늘 하루는 어땠어요?",
  "요즘 가장 자주 웃게 되는 순간은 언제예요?",
  "쉬는 날엔 집에 있는 편이에요, 나가는 편이에요?",
  "요즘 빠져 있는 게 있어요?",
];

const MAX_LOOKBACK = 12;

function isQuestion(text: string): boolean {
  return /[?？]\s*$/.test(text.trim());
}

/** 오래된 것 → 최신 순으로 정규화된 최근 메시지. */
function recent(messages: SuggestMessage[]): SuggestMessage[] {
  return messages.slice(-MAX_LOOKBACK);
}

/**
 * 다음 멘트 후보 3개. 항상 3개를 채우고, 중복은 없다.
 * 순수 함수 — 같은 입력이면 같은 출력(테스트로 고정).
 */
export function suggestReplies(input: SuggestRepliesInput): string[] {
  const msgs = recent(input.messages ?? []);
  const out: string[] = [];
  const push = (line: string) => {
    const t = line.trim();
    if (t && !out.includes(t) && out.length < 3) out.push(t);
  };

  const last = msgs[msgs.length - 1];
  const peerLast = [...msgs].reverse().find((m) => m.senderProfileId !== input.myProfileId);
  const peerSaidLast = !!last && last.senderProfileId !== input.myProfileId;

  // 1) 상대가 방금 질문했다면 답을 이어 갈 문장을 먼저 준다.
  if (peerSaidLast && isQuestion(last.content)) {
    for (const line of AFTER_QUESTION) push(line);
  }

  // 2) 최근 대화의 화제를 잡아 후속 질문으로 파고든다(상대 발화를 우선해서 본다).
  const haystack = [peerLast?.content ?? "", ...msgs.map((m) => m.content)].join(" ").toLowerCase();
  for (const topic of TOPICS) {
    if (topic.keywords.some((k) => haystack.includes(k))) {
      for (const line of topic.replies) push(line);
      break; // 화제는 하나만 — 세 줄이 전부 다른 주제면 오히려 산만하다.
    }
  }

  // 3) 대화가 6개 이상 오갔으면 만남 제안을 하나 섞는다.
  if (msgs.length >= 6) push(MEETUP[msgs.length % MEETUP.length]);

  // 4) 남는 자리는 부담 없는 새 화제로 채운다(대화 길이에 따라 시작점을 옮겨 매번 같은 줄만 나오지 않게).
  const offset = msgs.length % OPENERS.length;
  for (let i = 0; i < OPENERS.length && out.length < 3; i++) {
    push(OPENERS[(offset + i) % OPENERS.length]);
  }

  return out.slice(0, 3);
}
