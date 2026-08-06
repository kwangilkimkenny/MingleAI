/**
 * 온보딩 선호 입력의 단일 진실 — 자유서술 대신 **구조화 선택**(2026-08-06).
 *
 * 왜: "원하는 분위기"를 텍스트로 받으면 대부분 한 줄로 뭉뚱그려 적어 매칭 신호가 되지 못했다
 * (stub 분석기는 키워드가 안 걸리면 전부 기본값으로 수렴, LLM도 정보가 없으면 못 만든다).
 * 이제 클라이언트가 고른 선택지가 `PreferenceSignals`로 **결정적으로** 매핑되고, 자유 텍스트는
 * 선택 항목(색깔 한 줄)으로 내려간다. 점수 축(vibe·drinking·pace·activity·tags)과 1:1 대응.
 */
import type {
  PreferenceDrinking,
  PreferencePace,
  PreferenceSignals,
  PreferenceVibe,
} from "../types/preference.js";

export interface PreferenceOption<T extends string> {
  value: T;
  label: string;
  /** 선택 결과를 문장으로 요약할 때 쓰는 조각. */
  phrase: string;
}

export const VIBE_OPTIONS: readonly PreferenceOption<PreferenceVibe>[] = [
  { value: "calm", label: "차분하게", phrase: "차분한 분위기" },
  { value: "balanced", label: "그때그때", phrase: "상황에 맞추는 분위기" },
  { value: "energetic", label: "활발하게", phrase: "활발한 분위기" },
];

export const PACE_OPTIONS: readonly PreferenceOption<PreferencePace>[] = [
  { value: "slow", label: "천천히", phrase: "천천히 알아가는 페이스" },
  { value: "medium", label: "보통", phrase: "보통 페이스" },
  { value: "fast", label: "빠르게", phrase: "빠르게 가까워지는 페이스" },
];

export const DRINKING_OPTIONS: readonly PreferenceOption<PreferenceDrinking>[] = [
  { value: "none", label: "안 마셔요", phrase: "술은 안 마셔요" },
  { value: "light", label: "가볍게", phrase: "가볍게 한두 잔" },
  { value: "social", label: "즐겨요", phrase: "함께 술을 즐겨요" },
];

/** 데이트 맥락 활동 — 최소 1개, 최대 3개 선택. */
export const ACTIVITY_OPTIONS: readonly PreferenceOption<string>[] = [
  { value: "cafe", label: "카페 수다", phrase: "카페에서 대화" },
  { value: "food", label: "맛집 탐방", phrase: "맛집 탐방" },
  { value: "walk", label: "산책·드라이브", phrase: "산책과 드라이브" },
  { value: "culture", label: "전시·공연", phrase: "전시와 공연" },
  { value: "movie", label: "영화", phrase: "영화 감상" },
  { value: "sports", label: "운동·액티비티", phrase: "운동과 액티비티" },
  { value: "game", label: "보드게임·오락", phrase: "보드게임과 오락" },
  { value: "travel", label: "여행", phrase: "가까운 여행" },
];

export const MIN_ACTIVITIES = 1;
export const MAX_ACTIVITIES = 3;
export const MAX_NOTE_LENGTH = 100;

/** 온보딩/프로필 편집이 보내는 구조화 답변. */
export interface PreferenceAnswers {
  vibe: PreferenceVibe;
  pace: PreferencePace;
  drinking: PreferenceDrinking;
  /** ACTIVITY_OPTIONS의 value 1~3개. */
  activities: string[];
  /** 선택 — 한 줄 소개(분위기를 더 설명하고 싶을 때만). */
  note?: string;
}

const ACTIVITY_VALUES = new Set(ACTIVITY_OPTIONS.map((o) => o.value));

/** 한글 받침 유무로 목적격 조사 선택 — "드라이브를", "산책을". */
function objectParticle(word: string): "을" | "를" {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를"; // 한글이 아니면 기본형
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

function phraseOf<T extends string>(
  options: readonly PreferenceOption<T>[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.phrase ?? "";
}

/** 선택 결과 → 사람이 읽는 한국어 요약(상대에게 보이는 `preferenceSummary`·프로필 텍스트). */
export function describePreferences(answers: PreferenceAnswers): string {
  const acts = answers.activities
    .filter((a) => ACTIVITY_VALUES.has(a))
    .map((a) => phraseOf(ACTIVITY_OPTIONS, a))
    .filter(Boolean);
  const parts = [
    phraseOf(VIBE_OPTIONS, answers.vibe),
    phraseOf(PACE_OPTIONS, answers.pace),
    acts.length ? `${acts.join(", ")}${objectParticle(acts[acts.length - 1])} 좋아해요` : "",
    phraseOf(DRINKING_OPTIONS, answers.drinking),
  ].filter(Boolean);
  const base = parts.join(" · ");
  const note = answers.note?.trim();
  return note ? `${base} — ${note}` : base;
}

/**
 * 구조화 답변 → 매칭 신호. 결정적(분석기 불필요) — 선택지가 곧 점수 축이다.
 * `activity`와 `tags`는 같은 활동 집합을 담는다(점수 함수가 두 축을 각각 세므로, 활동이 겹치는
 * 상대에게 가중치가 두 번 붙는 의도된 설계 — 기존 stub 분석기와 동일한 형태).
 */
export function buildPreferenceSignals(answers: PreferenceAnswers): PreferenceSignals {
  const activities = answers.activities.filter((a) => ACTIVITY_VALUES.has(a)).slice(0, MAX_ACTIVITIES);
  return {
    vibe: answers.vibe,
    pace: answers.pace,
    drinking: answers.drinking,
    activity: activities,
    tags: activities,
    summary: describePreferences(answers).slice(0, 200),
  };
}

/** 저장된 신호 → 편집 화면이 다시 채울 답변(프로필 수정용). note는 요약문 꼬리에서 복원. */
export function answersFromSignals(signals: PreferenceSignals | null | undefined): PreferenceAnswers | null {
  if (!signals) return null;
  const note = signals.summary?.includes("—")
    ? signals.summary.split("—").slice(1).join("—").trim() || undefined
    : undefined;
  return {
    vibe: signals.vibe,
    pace: signals.pace,
    drinking: signals.drinking,
    activities: (signals.activity ?? []).filter((a) => ACTIVITY_VALUES.has(a)).slice(0, MAX_ACTIVITIES),
    note,
  };
}
