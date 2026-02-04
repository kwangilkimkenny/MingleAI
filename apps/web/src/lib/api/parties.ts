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
