import type { DirectMessageRoom } from "@mingle/shared";
import { apiFetch } from "./client.js";

/** Returns the list of match-based DM rooms (one per match). */
export function getMatches(): Promise<DirectMessageRoom[]> {
  return apiFetch<DirectMessageRoom[]>("/messenger/rooms");
}
