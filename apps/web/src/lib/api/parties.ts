import { apiFetch } from "./client";
import type { Party, PartyResults } from "@mingle/shared";

interface CreatePartyPayload {
  name: string;
  scheduledAt: string;
  maxParticipants?: number;
  theme?: string;
  roundCount?: number;
  roundDurationMinutes?: number;
}

export interface PartyWithCount extends Party {
  participantCount: number;
}

export interface ListPartiesResponse {
  parties: PartyWithCount[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListPartiesOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export function listParties(options: ListPartiesOptions = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", options.limit.toString());
  if (options.offset) params.set("offset", options.offset.toString());
  const qs = params.toString();
  return apiFetch<ListPartiesResponse>(`/parties${qs ? `?${qs}` : ""}`);
}

export function createParty(payload: CreatePartyPayload) {
  return apiFetch<Party>("/parties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getParty(id: string) {
  return apiFetch<Party>(`/parties/${id}`);
}

export function addParticipant(partyId: string, profileId: string) {
  return apiFetch<void>(`/parties/${partyId}/participants`, {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
}

export function runParty(partyId: string) {
  return apiFetch<Party>(`/parties/${partyId}/run`, {
    method: "POST",
  });
}

export async function getPartyResults(partyId: string) {
  const res = await apiFetch<{ results: PartyResults }>(
    `/parties/${partyId}/results`,
  );
  return res.results;
}
