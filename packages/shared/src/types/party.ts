export type PartyStatus = "matching" | "active" | "ended";

export interface Party {
  id: string;
  name: string;
  status: PartyStatus;
  maxParticipants: number;
  location?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}
