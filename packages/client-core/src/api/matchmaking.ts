import type { MatchmakingQueueEntry, MatchmakingStatus } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function enqueueMatchmaking(): Promise<MatchmakingQueueEntry> {
  return apiFetch<MatchmakingQueueEntry>("/matchmaking/queue", { method: "POST" });
}

export function cancelMatchmaking(): Promise<void> {
  return apiFetch<void>("/matchmaking/queue", { method: "DELETE" });
}

export function getMatchmakingStatus(): Promise<MatchmakingStatus> {
  return apiFetch<MatchmakingStatus>("/matchmaking/status");
}
