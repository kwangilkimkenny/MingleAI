/**
 * Among Us party minigame — CLIENT-facing snapshot types.
 *
 * The authoritative game state (all players' roles, votes, etc.) lives server-side in
 * `GameSession.state` and is NEVER sent to clients directly. The gateway projects a
 * per-viewer `AmongSnapshot` that hides other players' roles (until the game ends) and
 * exposes only the viewer's own tasks. See `apps/backend/src/party/among.service.ts`.
 */

export type AmongRole = "crew" | "impostor";
export type AmongPhase = "playing" | "meeting" | "voting" | "ended";

/** The four task minigames. */
export type AmongTaskKind = "wires" | "sequence" | "hold" | "timing";

/** A crew task station (only the viewer's own tasks are ever sent). */
export interface AmongTaskView {
  taskId: string;
  kind: AmongTaskKind;
  x: number;
  y: number;
  done: boolean;
}

/** A player as seen by a viewer — `role` is null unless it's the viewer or the game ended. */
export interface AmongPlayerView {
  profileId: string;
  name: string;
  alive: boolean;
  role: AmongRole | null;
}

/** A dead body on the map (position is server-stored from the kill payload). */
export interface AmongBodyView {
  profileId: string;
  x: number;
  y: number;
}

/** Active meeting/vote — vote targets stay hidden (only who voted) until reveal. */
export interface AmongMeetingView {
  reason: "report" | "emergency";
  calledBy: string;
  bodyProfileId?: string;
  phase: "discussion" | "voting";
  /** epoch ms deadline of the current sub-phase (discussion or voting). */
  endsAt: number;
  votedProfileIds: string[];
  /** Populated only on the post-resolution reveal snapshot. */
  tally?: Record<string, number>;
}

export interface AmongResultView {
  winner: AmongRole;
  reason: "tasks" | "ejected" | "kills";
}

/** Per-viewer projection of the game. */
export interface AmongSnapshot {
  sessionId: string;
  phase: AmongPhase;
  /** The viewer's own role (null if the viewer is not a player). */
  myRole: AmongRole | null;
  myProfileId: string;
  players: AmongPlayerView[];
  /** The viewer's own task stations (empty for impostors). */
  myTasks: AmongTaskView[];
  progress: { done: number; total: number };
  bodies: AmongBodyView[];
  /** The viewer's own kill cooldown deadline (impostor only), epoch ms. */
  killCooldownUntil: number | null;
  meeting: AmongMeetingView | null;
  lastEjected: { profileId: string; role: AmongRole; wasSkip: boolean } | null;
  result: AmongResultView | null;
}

/** among:state payload; snapshot null = no active among game (sync response). */
export interface AmongStateEvent {
  partyId: string;
  snapshot: AmongSnapshot | null;
}
