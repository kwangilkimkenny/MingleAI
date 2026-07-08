import { apiFetch } from "./client.js";

export const REPORT_REASONS = [
  "harassment",
  "fraud",
  "fake_profile",
  "inappropriate_content",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  reportedProfileId: string;
  reason: ReportReason;
  details?: string;
  evidencePartyId?: string;
}

export function reportUser(input: ReportInput): Promise<void> {
  return apiFetch<void>("/safety/report", { method: "POST", body: JSON.stringify(input) });
}
