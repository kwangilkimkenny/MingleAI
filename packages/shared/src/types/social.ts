export type ProposalStatus = "pending" | "accepted" | "declined";

export interface Proposal {
  id: string;
  partyId: string;
  fromProfileId: string;
  toProfileId: string;
  status: ProposalStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface Match {
  id: string;
  partyId?: string;
  proposalId?: string;
  profileId1: string;
  profileId2: string;
  createdAt: string;
}

export interface Block {
  id: string;
  blockerProfileId: string;
  blockedProfileId: string;
  createdAt: string;
}
