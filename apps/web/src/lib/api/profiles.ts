import { apiFetch } from "./client";
import type { Profile } from "@mingle/shared";

interface CreateProfilePayload {
  name: string;
  age: number;
  gender: string;
  location: string;
  occupation?: string;
  bio?: string;
  preferences: {
    ageRange: { min: number; max: number };
    genderPreference: string[];
    locationRadius: number;
    dealbreakers?: string[];
  };
  values: {
    relationshipGoal: string;
    lifestyle: string[];
    importantValues: string[];
  };
  communicationStyle: {
    tone: string;
    topics: string[];
  };
}

type UpdateProfilePayload = Partial<CreateProfilePayload>;

interface ProfileListResponse {
  data: Profile[];
  total: number;
}

export function createProfile(payload: CreateProfilePayload) {
  return apiFetch<Profile>("/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProfile(id: string) {
  return apiFetch<Profile>(`/profiles/${id}`);
}

export function listProfiles(params?: {
  location?: string;
  ageMin?: number;
  ageMax?: number;
  relationshipGoal?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return apiFetch<ProfileListResponse>(`/profiles${qs ? `?${qs}` : ""}`);
}

export function updateProfile(id: string, payload: UpdateProfilePayload) {
  return apiFetch<Profile>(`/profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
