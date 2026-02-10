import { apiFetch } from "./client";

export interface DashboardSummary {
  profileId: string;
  upcomingReservations: number;
  completedParties: number;
  totalMatches: number;
  unreadNotifications: number;
}

export interface MyParty {
  id: string;
  name: string;
  scheduledAt: string;
  maxParticipants: number;
  theme?: string;
  status: string;
  participantCount: number;
  joinedAt: string;
  isUpcoming: boolean;
}

export interface MyPartiesResponse {
  parties: MyParty[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyMatch {
  id: string;
  partyId: string;
  partyName: string;
  reportType: string;
  matchScores: Record<string, unknown>;
  highlights: unknown[];
  recommendations: unknown[];
  createdAt: string;
}

export interface MyMatchesResponse {
  matches: MyMatch[];
  total: number;
  limit: number;
  offset: number;
}

export async function getDashboardSummary(
  profileId: string,
): Promise<DashboardSummary> {
  return apiFetch(`/dashboard/summary?profileId=${profileId}`);
}

export async function getMyParties(
  profileId: string,
  limit?: number,
  offset?: number,
): Promise<MyPartiesResponse> {
  const params = new URLSearchParams({ profileId });
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return apiFetch(`/dashboard/my-parties?${params.toString()}`);
}

export async function getMyReservations(
  profileId: string,
  status?: string,
  limit?: number,
  offset?: number,
) {
  const params = new URLSearchParams({ profileId });
  if (status) params.set("status", status);
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return apiFetch(`/dashboard/my-reservations?${params.toString()}`);
}

export async function getMyMatches(
  profileId: string,
  limit?: number,
  offset?: number,
): Promise<MyMatchesResponse> {
  const params = new URLSearchParams({ profileId });
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  return apiFetch(`/dashboard/my-matches?${params.toString()}`);
}
