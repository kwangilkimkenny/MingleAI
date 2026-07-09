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

/** A persisted party-wide chat message (REST history + socket broadcast payload). */
export interface PartyMessageView {
  id: string;
  partyId: string;
  profileId: string;
  content: string;
  createdAt: string;
}

/** Live roster of a party room — distinct profileIds currently connected. */
export interface PartyPresence {
  partyId: string;
  members: string[];
}

/** An ephemeral position update broadcast to other party members (2D space, Phase 6b). */
export interface PartyMove {
  profileId: string;
  x: number;
  y: number;
}

/** Balance-game vote choice. */
export type GameChoice = "a" | "b";

/** A completed (revealed) balance-game round. */
export interface GameReveal {
  round: number;
  question: { a: string; b: string };
  aVoters: string[];
  bVoters: string[];
}

/** Public snapshot of a party's game — current-round choices stay hidden. */
export interface GameSnapshot {
  sessionId: string;
  gameType: "balance";
  status: "active" | "ended";
  round: number;
  totalRounds: number;
  question: { a: string; b: string } | null;
  votedProfileIds: string[];
  reveals: GameReveal[];
}

/** game:state payload; snapshot null = no active game (sync response). */
export interface GameStateEvent {
  partyId: string;
  snapshot: GameSnapshot | null;
}
