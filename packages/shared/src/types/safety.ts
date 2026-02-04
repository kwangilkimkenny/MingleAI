export type SafetyContext = "profile_bio" | "conversation" | "message" | "report";

export type ViolationType =
  | "personal_info_leak"
  | "harassment"
  | "hate_speech"
  | "explicit_content"
  | "fraud_signal"
  | "spam"
  | "external_link";

export type ViolationSeverity = "low" | "medium" | "high" | "critical";

export interface Violation {
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  matchedContent?: string;
}

export interface SafetyResult {
  safe: boolean;
  violations: Violation[];
  riskScore: number;
  sanitizedContent?: string;
}

export type SafetyReportReason =
  | "harassment"
  | "fraud"
  | "fake_profile"
  | "inappropriate_content"
  | "spam"
  | "other";

export type SafetyReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export interface SafetyReport {
  id: string;
  reporterProfileId: string;
  reportedProfileId: string;
  reason: SafetyReportReason;
  details?: string;
  evidencePartyId?: string;
  status: SafetyReportStatus;
  createdAt: string;
}
