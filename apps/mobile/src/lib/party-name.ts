/** 파티 화면 공용 표시명 해석 — 파티 참가자 우선, 없으면 among 스냅샷(AI 페르소나) 폴백. */
export function resolveDisplayName(
  profileId: string,
  participants: ReadonlyArray<{ profileId: string; name: string }>,
  amongPlayers: ReadonlyArray<{ profileId: string; name: string }> | undefined,
  myProfileId: string | null,
): string {
  if (myProfileId !== null && profileId === myProfileId) return "나";
  return (
    participants.find((p) => p.profileId === profileId)?.name ??
    amongPlayers?.find((p) => p.profileId === profileId)?.name ??
    "?"
  );
}
