export interface DirectMessageRoom {
  id: string;
  matchId: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  roomId: string;
  senderProfileId: string;
  content: string;
  readAt?: string;
  createdAt: string;
}

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
