import { apiFetch } from "./client";
import type { Report } from "@mingle/shared";

interface GenerateReportPayload {
  partyId: string;
  profileId: string;
  reportType?: "summary" | "detailed";
}

interface ReportListResponse {
  data: Report[];
  total: number;
}

export function generateReport(payload: GenerateReportPayload) {
  return apiFetch<Report>("/reports/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReport(id: string) {
  return apiFetch<Report>(`/reports/${id}`);
}

export function listReports(
  profileId: string,
  params?: { limit?: number; offset?: number },
) {
  const query = new URLSearchParams({ profileId });
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  return apiFetch<ReportListResponse>(`/reports?${query.toString()}`);
}
