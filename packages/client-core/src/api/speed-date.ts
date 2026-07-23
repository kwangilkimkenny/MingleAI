import type { SpeedDateStatus } from "@mingle/shared";
import { apiFetch } from "./client.js";

/** Join the blind speed-date queue. Consent is captured at signup (the onboarding gate), so no
 *  per-session consent is needed here. */
export function enqueueSpeedDate(): Promise<{ status: "waiting" }> {
  return apiFetch<{ status: "waiting" }>("/speed-date/queue", { method: "POST" });
}

export function cancelSpeedDate(): Promise<void> {
  return apiFetch<void>("/speed-date/queue", { method: "DELETE" });
}

export function getSpeedDateStatus(): Promise<SpeedDateStatus> {
  return apiFetch<SpeedDateStatus>("/speed-date/status");
}
