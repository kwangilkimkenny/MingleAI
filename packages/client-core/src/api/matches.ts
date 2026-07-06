import type { MatchSummary } from "@mingle/shared";
import { apiFetch } from "./client.js";

/** Returns the list of match-based DM rooms (one per match), with peer + unread info. */
export function getMatches(): Promise<MatchSummary[]> {
  return apiFetch<MatchSummary[]>("/messenger/rooms");
}
