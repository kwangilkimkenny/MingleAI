export interface Profile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  partyPreferenceText: string;
  preferenceSignals?: unknown;
  photoUrl?: string;
  interests?: unknown;
  bio?: string;
  location?: string;
  riskScore: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
