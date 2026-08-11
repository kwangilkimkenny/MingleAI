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

/**
 * 재연결 후 빈 구간 메우기 — 이미 가진 것을 빼고 합친 뒤 **전체를 다시 정렬**한다.
 *
 * 예전에는 새 메시지를 무조건 맨 앞(=화면 맨 아래, 가장 최근 자리)에 붙였다. 그런데 끊긴 동안
 * 놓친 메시지가 내가 방금 보낸 것보다 **오래된** 경우가 흔하다(재연결 직후 낙관적 전송 → 히스토리
 * 도착). 그러면 옛 메시지가 최신 자리에 꽂혀 대화 순서가 뒤집힌다(2026-08-11 감사).
 * 새로 붙일 게 없으면 같은 배열 참조를 돌려줘 헛 렌더를 막는다.
 */
export function mergeNewest<T extends OrderableMessage>(prev: T[], incoming: T[]): T[] {
  const seen = new Set(prev.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length === 0 ? prev : newestFirst([...added, ...prev]);
}
