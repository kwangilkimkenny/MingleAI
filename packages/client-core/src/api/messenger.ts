import type { DirectMessage } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function getRoomMessages(roomId: string, before?: string): Promise<DirectMessage[]> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch<DirectMessage[]>(`/messenger/rooms/${roomId}/messages${qs}`);
}

export function sendMessage(roomId: string, content: string): Promise<DirectMessage> {
  return apiFetch<DirectMessage>(`/messenger/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function markRoomRead(roomId: string): Promise<void> {
  return apiFetch<void>(`/messenger/rooms/${roomId}/read`, { method: "POST" });
}
