export type MatchmakingQueueStatus = "waiting" | "matched" | "cancelled";

export interface MatchmakingQueueEntry {
  id: string;
  profileId: string;
  status: MatchmakingQueueStatus;
  preferenceSnapshot: unknown;
  matchedPartyId?: string;
  enqueuedAt: string;
  updatedAt: string;
}
