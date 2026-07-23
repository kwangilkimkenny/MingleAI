import type { SpeedDateStatus } from "@mingle/shared";
import { apiFetch } from "./client.js";

/** Optional geo for radius-based matching (location is opt-in). */
export type SpeedDateEnqueueOptions = { lat?: number; lng?: number; radiusKm?: number };

/** Join the blind speed-date queue. Consent is captured at signup (the onboarding gate), so no
 *  per-session consent is needed here. Pass coords + radius to match within a distance. */
export function enqueueSpeedDate(opts?: SpeedDateEnqueueOptions): Promise<{ status: "waiting" }> {
  return apiFetch<{ status: "waiting" }>("/speed-date/queue", {
    method: "POST",
    body: opts ? JSON.stringify(opts) : undefined,
  });
}

export function cancelSpeedDate(): Promise<void> {
  return apiFetch<void>("/speed-date/queue", { method: "DELETE" });
}

export function getSpeedDateStatus(): Promise<SpeedDateStatus> {
  return apiFetch<SpeedDateStatus>("/speed-date/status");
}
