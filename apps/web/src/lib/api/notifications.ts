import { apiFetch } from "./client";

export interface Notification {
  id: string;
  userId: string;
  type: "party_reminder" | "match_result" | "reservation" | "system";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export async function getNotifications(
  limit?: number,
  offset?: number,
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());
  const query = params.toString();
  return apiFetch(`/notifications${query ? `?${query}` : ""}`);
}

export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  return apiFetch("/notifications/unread-count");
}

export async function markAsRead(id: string): Promise<void> {
  return apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllAsRead(): Promise<void> {
  return apiFetch("/notifications/read-all", { method: "POST" });
}

export async function deleteNotification(id: string): Promise<void> {
  return apiFetch(`/notifications/${id}`, { method: "DELETE" });
}
