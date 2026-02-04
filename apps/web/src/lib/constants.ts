export const GENDER_LABELS: Record<string, string> = {
  male: "남성",
  female: "여성",
  non_binary: "논바이너리",
  prefer_not_to_say: "밝히지 않음",
};

export const GENDER_PREF_LABELS: Record<string, string> = {
  male: "남성",
  female: "여성",
  non_binary: "논바이너리",
  any: "상관없음",
};

export const RELATIONSHIP_GOAL_LABELS: Record<string, string> = {
  casual: "가벼운 만남",
  dating: "연애",
  serious: "진지한 관계",
  marriage: "결혼",
};

export const TONE_LABELS: Record<string, string> = {
  warm: "따뜻한",
  witty: "위트있는",
  direct: "직접적인",
  thoughtful: "사려깊은",
  playful: "장난스러운",
};

export const PARTY_STATUS_LABELS: Record<string, string> = {
  scheduled: "예정됨",
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "취소됨",
};

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  interest: "관심",
  rapport: "라포",
  shared_value: "공유 가치",
  humor: "유머",
  deep_conversation: "깊은 대화",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  summary: "요약",
  detailed: "상세",
};

export const SAFETY_REASON_LABELS: Record<string, string> = {
  harassment: "괴롭힘",
  fraud: "사기",
  fake_profile: "허위 프로필",
  inappropriate_content: "부적절한 콘텐츠",
  spam: "스팸",
  other: "기타",
};

export const SAFETY_CONTEXT_LABELS: Record<string, string> = {
  profile_bio: "프로필 소개",
  conversation: "대화",
  message: "메시지",
  report: "리포트",
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  send_message: "메시지 보내기",
  ask_question: "질문하기",
  suggest_date: "데이트 제안",
  learn_more: "더 알아보기",
  pass: "패스",
};

export const DATE_PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  confirmed: "확정",
  completed: "완료",
};
