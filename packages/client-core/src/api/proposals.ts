import type { Proposal, ProposalView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function sendProposal(partyId: string, toProfileId: string): Promise<Proposal> {
  return apiFetch<Proposal>("/proposals", { method: "POST", body: JSON.stringify({ partyId, toProfileId }) });
}

export function getReceivedProposals(): Promise<ProposalView[]> {
  return apiFetch<ProposalView[]>("/proposals/received");
}

export function getSentProposals(): Promise<ProposalView[]> {
  return apiFetch<ProposalView[]>("/proposals/sent");
}

export function acceptProposal(id: string): Promise<{ matchId: string; roomId: string }> {
  return apiFetch<{ matchId: string; roomId: string }>(`/proposals/${id}/accept`, { method: "POST" });
}

export function declineProposal(id: string): Promise<void> {
  return apiFetch<void>(`/proposals/${id}/decline`, { method: "POST" });
}
