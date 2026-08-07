/**
 * 채팅 목록 정렬 — 화면은 `inverted` FlatList라 배열 첫 항목이 화면 맨 **아래**(가장 최근)다.
 * 서버 히스토리는 오래된 → 최신 순으로 오므로 그대로 넣으면 대화가 거꾸로 보인다
 * (QA 2026-08-07). 소켓 수신·낙관적 전송은 이미 앞에 붙이므로 같은 방향(최신 우선)을 지킨다.
 */
export interface OrderableMessage {
  id: string;
  createdAt: string;
}

/** 최신 → 오래된 순. 같은 시각이면 id로 안정 정렬(서버가 같은 ms에 두 건을 만들 수 있다). */
export function newestFirst<T extends OrderableMessage>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** 이미 있는 메시지를 빼고 최신 우선으로 앞에 붙인다(재연결 후 빈 구간 메우기). */
export function mergeNewest<T extends OrderableMessage>(prev: T[], incoming: T[]): T[] {
  const seen = new Set(prev.map((m) => m.id));
  const added = newestFirst(incoming).filter((m) => !seen.has(m.id));
  return added.length === 0 ? prev : [...added, ...prev];
}
