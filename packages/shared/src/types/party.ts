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
