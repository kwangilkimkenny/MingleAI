import type { PreferenceSignals } from "./preference.js";

export interface Profile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  partyPreferenceText: string;
  preferenceSignals?: PreferenceSignals | null;
  photoUrl?: string;
  interests?: unknown;
  bio?: string;
  location?: string;
  riskScore?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
