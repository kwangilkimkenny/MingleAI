import { apiFetch } from "./client.js";

export function registerDevice(token: string, platform: "ios" | "android"): Promise<void> {
  return apiFetch<void>("/devices", { method: "POST", body: JSON.stringify({ token, platform }) });
}

export function unregisterDevice(token: string): Promise<void> {
  return apiFetch<void>(`/devices/${token}`, { method: "DELETE" });
}

export function setPushEnabled(pushEnabled: boolean): Promise<void> {
  return apiFetch<void>("/users/me/push", { method: "PATCH", body: JSON.stringify({ pushEnabled }) });
}

export function getPushEnabled(): Promise<{ pushEnabled: boolean }> {
  return apiFetch("/users/me/push");
}
