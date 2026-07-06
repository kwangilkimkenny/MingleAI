export interface PartyMessage {
  id: string;
  partyId: string;
  profileId: string;
  content: string;
  createdAt: string;
}

export type GameSessionStatus = "active" | "ended";

export interface GameSession {
  id: string;
  partyId: string;
  gameType: string;
  state: unknown;
  status: GameSessionStatus;
  result?: unknown;
  startedAt: string;
  endedAt?: string;
}
