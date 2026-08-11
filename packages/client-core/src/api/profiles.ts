import type { Profile, PreferenceAnswers } from "@mingle/shared";
import { apiFetch, ApiError } from "./client.js";
import { getClientConfig, getToken } from "../config.js";

export interface CreateProfileInput {
  name: string;
  /** 본인인증 완료 계정은 서버가 verified 값을 사용 — 생략. */
  age?: number;
  gender?: string;
  occupation: string;
  /** 구조화 선호(권장) — 보내면 서버가 신호·요약문을 결정적으로 만든다. */
  preferences?: PreferenceAnswers;
  /** 레거시 자유서술 — `preferences`를 보내면 불필요. */
  partyPreferenceText?: string;
  bio?: string;
  location?: string;
  photoUrl?: string;
  interests?: unknown;
}

export interface UpdateProfileInput {
  name?: string;
  /** age·gender는 본인인증이 정한다 — 서버가 수정 요청을 400으로 막는다(2026-08-11). */
  occupation?: string;
  preferences?: PreferenceAnswers;
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
 * Upload an image to POST /uploads/photo and return its public URL.
 *
 * 파일 파트는 **XMLHttpRequest**로 보낸다. React Native의 `{uri,name,type}` 파트는 네이티브
 * 네트워킹 계층이 직접 읽어 스트리밍하는데, Expo SDK 56의 fetch 구현은 그 파트를 거부한다
 * ("Unsupported FormDataPart implementation" — 채팅 사진 첨부 QA 2026-08-07). XHR은 RN·브라우저
 * 양쪽에 있고 multipart 경계도 스스로 만든다 — Content-Type을 손으로 넣으면 boundary가 깨진다.
 */
export function uploadPhoto(file: UploadPhotoFile): Promise<{ url: string }> {
  const { baseUrl, onUnauthorized } = getClientConfig();
  const token = getToken();

  const form = new FormData();
  if (typeof (file as { uri?: string }).uri === "string") {
    // RN 파트 객체 — 타입만 Blob으로 맞춰 준다(런타임 형태는 그대로여야 한다).
    form.append("file", file as unknown as Blob);
  } else {
    const blob = file as Blob;
    form.append("file", blob, (blob as File).name || "photo.jpg");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/uploads/photo`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status === 401 && token) {
        onUnauthorized?.();
        reject(new ApiError(401, "인증이 만료되었습니다."));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `업로드 실패 (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string | string[] };
          const raw = Array.isArray(body.message) ? body.message.join("\n") : body.message;
          if (raw) message = raw;
        } catch {
          // 본문이 JSON이 아니면 기본 문구를 쓴다.
        }
        reject(new ApiError(xhr.status, message));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as { url: string });
      } catch {
        reject(new ApiError(xhr.status, "업로드 응답을 읽지 못했어요."));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "네트워크 오류로 업로드하지 못했어요."));
    xhr.ontimeout = () => reject(new ApiError(0, "업로드가 시간 초과됐어요."));
    xhr.send(form);
  });
}
