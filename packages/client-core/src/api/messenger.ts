import type { DirectMessage } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function getRoomMessages(roomId: string, before?: string): Promise<DirectMessage[]> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch<DirectMessage[]>(`/messenger/rooms/${roomId}/messages${qs}`);
}

/** `imageUrl`은 `uploadPhoto`가 돌려준 우리 업로드 URL만 서버가 받는다(사진만 보내려면 content=""). */
export function sendMessage(
  roomId: string,
  content: string,
  imageUrl?: string,
): Promise<DirectMessage> {
  return apiFetch<DirectMessage>(`/messenger/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify(imageUrl ? { content, imageUrl } : { content }),
  });
}

export function markRoomRead(roomId: string): Promise<void> {
  return apiFetch<void>(`/messenger/rooms/${roomId}/read`, { method: "POST" });
}

/** 대화 내용 기반 다음 멘트 추천(서버에서 LLM 호출, 미설정·실패 시 규칙 폴백). */
export function suggestReplies(roomId: string): Promise<{ suggestions: string[]; source: "ai" | "fallback" }> {
  return apiFetch<{ suggestions: string[]; source: "ai" | "fallback" }>(
    `/messenger/rooms/${roomId}/suggestions`,
    { method: "POST" },
  );
}
