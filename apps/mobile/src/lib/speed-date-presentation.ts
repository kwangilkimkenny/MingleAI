import type { SpeedDateMediaStatus } from "./speed-date-media";

export function speedDateConnectionCopy(status: SpeedDateMediaStatus): string {
  if (status === "connected") return "연결 안정";
  if (status === "connecting") return "미디어 연결 중";
  if (status === "unavailable") return "미디어 연결 안 됨";
  return "미디어 준비 중";
}

export function speedDateFaceFallbackCopy(status: SpeedDateMediaStatus): string {
  if (status === "connecting" || status === "idle") return "상대 영상을 연결하고 있어요.";
  if (status === "unavailable") return "영상을 연결할 수 없어 아바타로 대화를 이어가요.";
  return "상대 카메라가 꺼져 있어 아바타로 대화를 이어가요.";
}

export function speedDateProgressCopy(input: {
  stageIndex: number;
  stageCount: number;
  roundIndex: number;
  roundCount: number;
}): string {
  const conversation = input.stageIndex * input.roundCount + input.roundIndex + 1;
  const total = input.stageCount * input.roundCount;
  return `단계 ${input.stageIndex + 1}/${input.stageCount} · 대화 ${conversation}/${total}`;
}
