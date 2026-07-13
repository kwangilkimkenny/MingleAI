import type { Profile } from "@mingle/shared";
import { apiFetch, ApiError } from "./client.js";
import { getClientConfig, getToken } from "../config.js";

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

export interface UpdateProfileInput {
  name?: string;
  age?: number;
  gender?: string;
  occupation?: string;
  partyPreferenceText?: string;
  bio?: string;
  location?: string;
  photoUrl?: string;
  interests?: unknown;
}

/**
 * A file to upload. React Native supplies a `{ uri, name, type }` part (from
 * expo-image-picker); web supplies a Blob/File. `uploadPhoto` handles both.
 */
export type UploadPhotoFile = { uri: string; name: string; type: string } | Blob;

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

export function updateProfile(profileId: string, input: UpdateProfileInput): Promise<Profile> {
  return apiFetch<Profile>(`/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * Upload an image to POST /uploads/photo and return its public URL. Uses a raw
 * multipart request (NOT apiFetch, which forces application/json) so fetch can
 * set the multipart boundary itself — setting Content-Type manually breaks it.
 */
export async function uploadPhoto(file: UploadPhotoFile): Promise<{ url: string }> {
  const { baseUrl, onUnauthorized } = getClientConfig();
  const token = getToken();

  const form = new FormData();
  if (typeof (file as { uri?: string }).uri === "string") {
    // React Native FormData accepts the {uri,name,type} part object directly.
    form.append("file", file as unknown as Blob);
  } else {
    const blob = file as Blob;
    const name = (blob as File).name || "photo.jpg";
    form.append("file", blob, name);
  }

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}/uploads/photo`, {
    method: "POST",
    body: form,
    headers,
  });

  if (res.status === 401 && token) {
    onUnauthorized?.();
    throw new ApiError(401, "인증이 만료되었습니다.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string | string[] });
    const rawMessage = Array.isArray(body.message) ? body.message.join("\n") : body.message;
    throw new ApiError(res.status, rawMessage || `업로드 실패 (${res.status})`);
  }
  return res.json();
}
