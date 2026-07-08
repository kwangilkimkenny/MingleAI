import type { ReportReason } from "@mingle/client-core";

export const REASON_LABELS: Record<ReportReason, string> = {
  harassment: "괴롭힘 / 폭언",
  fraud: "사기 / 금전 요구",
  fake_profile: "가짜 프로필 / 사칭",
  inappropriate_content: "부적절한 콘텐츠",
  spam: "스팸 / 광고",
  other: "기타",
};

export function reasonLabel(reason: ReportReason): string {
  return REASON_LABELS[reason];
}
