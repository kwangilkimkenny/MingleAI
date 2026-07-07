import { apiFetch } from "./client.js";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: unknown;
  read: boolean;
  createdAt: string;
}

export function getNotifications(
  limit = 50,
  offset = 0,
): Promise<{ notifications: AppNotification[]; total: number; limit: number; offset: number }> {
  return apiFetch(`/notifications?limit=${limit}&offset=${offset}`);
}

export function getUnreadCount(): Promise<{ unreadCount: number }> {
  return apiFetch("/notifications/unread-count");
}

export function markNotificationRead(id: string): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}
