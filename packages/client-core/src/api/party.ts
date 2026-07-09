import type { PartyMessageView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function getPartyMessages(partyId: string): Promise<PartyMessageView[]> {
  return apiFetch<PartyMessageView[]>(`/parties/${partyId}/messages`);
}
