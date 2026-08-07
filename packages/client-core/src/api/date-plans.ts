import type { DatePlanView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export interface CreateDatePlanInput {
  matchId: string;
  budget: { total: number; currency?: string };
  /** lat/lng를 주면 서버가 그 동네의 실제 가게로 코스를 채운다. */
  location: { city: string; district?: string; maxTravelMinutes?: number; lat?: number; lng?: number };
  dateTime: { preferredDate: string; durationHours?: number };
  preferences?: { cuisineTypes?: string[]; activityTypes?: string[]; avoidTypes?: string[] };
}

export function createDatePlan(input: CreateDatePlanInput): Promise<DatePlanView> {
  return apiFetch<DatePlanView>("/date-plans", { method: "POST", body: JSON.stringify(input) });
}

export function getDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}`);
}

export function getDatePlansForMatch(matchId: string): Promise<DatePlanView[]> {
  return apiFetch<DatePlanView[]>(`/date-plans?matchId=${matchId}`);
}

export function selectCourse(id: string, courseId: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/select`, {
    method: "PATCH",
    body: JSON.stringify({ courseId }),
  });
}

export function confirmDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/confirm`, { method: "PATCH" });
}

export function cancelDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/cancel`, { method: "PATCH" });
}

export function completeDatePlan(id: string): Promise<DatePlanView> {
  return apiFetch<DatePlanView>(`/date-plans/${id}/complete`, { method: "PATCH" });
}
