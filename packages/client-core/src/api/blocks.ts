import type { PeerProfile } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function createBlock(blockedProfileId: string): Promise<void> {
  return apiFetch<void>("/safety/blocks", { method: "POST", body: JSON.stringify({ blockedProfileId }) });
}

export function getBlocks(): Promise<PeerProfile[]> {
  return apiFetch<PeerProfile[]>("/safety/blocks");
}

export function removeBlock(blockedProfileId: string): Promise<void> {
  return apiFetch<void>(`/safety/blocks/${blockedProfileId}`, { method: "DELETE" });
}
