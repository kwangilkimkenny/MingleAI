export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";
export type GenderPreference = "male" | "female" | "non_binary" | "any";
export type RelationshipGoal = "casual" | "dating" | "serious" | "marriage";
export type ConversationTone = "warm" | "witty" | "direct" | "thoughtful" | "playful";
export type ProfileStatus = "active" | "suspended" | "banned";

export interface UserPreferences {
  ageRange: { min: number; max: number };
  genderPreference: GenderPreference[];
  locationRadius: number;
  dealbreakers?: string[];
}

export interface UserValues {
  relationshipGoal: RelationshipGoal;
  lifestyle: string[];
  importantValues: string[];
}

export interface CommunicationStyle {
  tone: ConversationTone;
  topics: string[];
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: Gender;
  location: string;
  occupation?: string;
  preferences: UserPreferences;
  values: UserValues;
  communicationStyle: CommunicationStyle;
  bio?: string;
  agentPersona: string;
  riskScore: number;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}
