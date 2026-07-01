import type { Profile } from "@mingle/shared";
import { apiFetch, ApiError } from "./client.js";

export interface CreateProfileInput {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  partyPreferenceText: string;
  bio?: string;
  location?: string;
  photoUrl?: string;
  interests?: unknown;
}

export async function getMyProfile(): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>("/profiles/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function createProfile(input: CreateProfileInput): Promise<Profile> {
  return apiFetch<Profile>("/profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
