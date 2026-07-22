import type { SpeedDateStatus } from "@mingle/shared";
import { apiFetch } from "./client.js";

/** Join the blind speed-date queue. `consent` must be an explicit user acknowledgement. */
export function enqueueSpeedDate(consent: boolean): Promise<{ status: "waiting" }> {
  return apiFetch<{ status: "waiting" }>("/speed-date/queue", {
    method: "POST",
    body: JSON.stringify({ consent }),
  });
}

export function cancelSpeedDate(): Promise<void> {
  return apiFetch<void>("/speed-date/queue", { method: "DELETE" });
}

export function getSpeedDateStatus(): Promise<SpeedDateStatus> {
  return apiFetch<SpeedDateStatus>("/speed-date/status");
}
