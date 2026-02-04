import { apiFetch } from "./client";
import type { DatePlan } from "@mingle/shared";

interface CreateDatePlanPayload {
  profileId1: string;
  profileId2: string;
  budget: { total: number; currency?: string };
  location: { city: string; district?: string; maxTravelMinutes?: number };
  dateTime: { preferredDate: string; durationHours?: number };
  preferences?: {
    cuisineTypes?: string[];
    activityTypes?: string[];
    avoidTypes?: string[];
  };
}

export function createDatePlan(payload: CreateDatePlanPayload) {
  return apiFetch<DatePlan>("/date-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDatePlan(id: string) {
  return apiFetch<DatePlan>(`/date-plans/${id}`);
}
