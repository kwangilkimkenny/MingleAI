export type MatchmakingQueueStatus = "none" | "waiting" | "matched" | "cancelled";

export interface MatchmakingQueueEntry {
  id: string;
  status: "waiting" | "matched" | "cancelled";
  enqueuedAt: string;
  matchedPartyId?: string | null;
}

export interface PublicPartyParticipant {
  profileId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  photoUrl?: string;
  preferenceSummary?: string;
}

export interface PublicParty {
  id: string;
  name: string;
  status: string;
  participants: PublicPartyParticipant[];
}

export interface MatchmakingStatus {
  status: MatchmakingQueueStatus;
  elapsedMs?: number;
  estimatedWaitMs?: number;
  matchedPartyId?: string;
  party?: PublicParty;
}
