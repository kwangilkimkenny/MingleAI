import { apiFetch } from "./client";
import type { SafetyResult, SafetyReport } from "@mingle/shared";

export function checkContent(content: string, context: string) {
  return apiFetch<SafetyResult>("/safety/check", {
    method: "POST",
    body: JSON.stringify({ content, context }),
  });
}

export function reportUser(payload: {
  reportedProfileId: string;
  reason: string;
  details?: string;
  evidencePartyId?: string;
}) {
  return apiFetch<SafetyReport>("/safety/report", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
