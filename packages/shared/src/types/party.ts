import type { UserPreferences, UserValues } from "./profile.js";

export type PartyStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Party {
  id: string;
  name: string;
  scheduledAt: string;
  maxParticipants: number;
  theme?: string;
  roundCount: number;
  roundDurationMinutes: number;
  status: PartyStatus;
  results?: PartyResults;
  createdAt: string;
  updatedAt: string;
}

export interface TableAssignment {
  tableId: string;
  profileIds: string[];
}

export interface ParticipantContext {
  profileId: string;
  name: string;
  agentPersona: string;
  relevantPreferences: Partial<UserPreferences>;
  relevantValues: Partial<UserValues>;
}

export interface ConversationContext {
  tableId: string;
  participants: ParticipantContext[];
  suggestedTopics: string[];
  icebreaker: string;
}

export interface RoundResult {
  roundNumber: number;
  tables: TableAssignment[];
  conversationContexts: ConversationContext[];
}

export interface InteractionSignal {
  fromProfileId: string;
  toProfileId: string;
  signalType: "interest" | "rapport" | "shared_value" | "humor" | "deep_conversation";
  strength: number;
  context: string;
}

export interface PartyResults {
  rounds: RoundResult[];
  interactionSignals: InteractionSignal[];
}
