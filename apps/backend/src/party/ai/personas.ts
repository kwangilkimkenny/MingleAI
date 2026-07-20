import { randomUUID } from "node:crypto";

/**
 * AI 임포스터 페르소나 풀 — 게임 세션 안에서만 존재하는 가짜 프로필.
 * profileId는 "ai-" 접두 합성 ID(실 Profile 테이블에 없음 → 프로포즈/DM/신고 구조적 불가).
 */
export const AI_PROFILE_PREFIX = "ai-";

export interface AiPersona {
  profileId: string;
  name: string;
  age: number;
  gender: "male" | "female";
  occupation: string;
  /** LLM 프롬프트에 들어가는 말투/성격 한 줄. */
  style: string;
}

const POOL: Omit<AiPersona, "profileId">[] = [
  { name: "서지우", age: 27, gender: "female", occupation: "마케터", style: "말끝을 흐리며 ㅋㅋ를 자주 붙이는 무심한 말투" },
  { name: "한도윤", age: 29, gender: "male", occupation: "개발자", style: "짧고 건조하게 답하지만 가끔 드립을 치는 말투" },
  { name: "임채린", age: 26, gender: "female", occupation: "간호사", style: "리액션이 크고 이모티콘 없이도 텐션 높은 말투" },
  { name: "정하람", age: 31, gender: "male", occupation: "요리사", style: "느긋하고 존댓말 반말을 섞는 말투" },
  { name: "오세아", age: 28, gender: "female", occupation: "디자이너", style: "관찰평을 툭 던지는 시니컬한 말투" },
  { name: "강이준", age: 30, gender: "male", occupation: "트레이너", style: "단답 위주에 가끔 진지해지는 말투" },
  { name: "문가을", age: 25, gender: "female", occupation: "대학원생", style: "질문을 자주 던지는 호기심 많은 말투" },
  { name: "백시헌", age: 32, gender: "male", occupation: "회계사", style: "정중하지만 은근히 남 의심하는 말투" },
];

/** count명 추출 — takenNames(참가 인간 이름)와 충돌 회피, rand/makeId 주입으로 테스트 결정성. */
export function pickPersonas(
  count: number,
  takenNames: Set<string>,
  rand: () => number = Math.random,
  makeId: () => string = randomUUID,
): AiPersona[] {
  const candidates = POOL.filter((p) => !takenNames.has(p.name));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count).map((p) => ({ ...p, profileId: `${AI_PROFILE_PREFIX}${makeId()}` }));
}

const FALLBACK: Record<"idle" | "meeting", string[]> = {
  idle: [
    "여기 미션 은근 어렵네요",
    "다들 어디쪽에 있어요?",
    "아까부터 좀 조용하지 않아요?",
    "저 방금 미션 하나 끝냈어요",
    "누가 계속 따라오는 느낌인데 기분탓인가",
    "ㅋㅋ 조작 아직도 헷갈리네",
  ],
  meeting: [
    "저는 아까 계속 미션하고 있었어요",
    "움직임이 이상한 사람 있지 않았어요?",
    "일단 증거 없이 찍는 건 좀...",
    "저 아까 두 명이 같이 있는 거 봤어요",
    "스킵하고 좀 더 지켜보는 게 낫지 않아요?",
    "말 없는 사람이 제일 수상한데요",
  ],
};

/** LLM 실패/미설정 시 폴백 대사. */
export function fallbackLine(scene: "idle" | "meeting", rand: () => number = Math.random): string {
  const pool = FALLBACK[scene];
  return pool[Math.floor(rand() * pool.length) % pool.length]!;
}
