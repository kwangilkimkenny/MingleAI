/**
 * Blind Speed Date — CLIENT-facing snapshot types.
 *
 * The authoritative session state (participants, full schedule, everyone's private
 * choices) lives server-side in `SpeedDateSession.state` and is NEVER sent to clients
 * directly. The gateway projects a per-viewer `SpeedDateSnapshot` that reveals only the
 * viewer's current partner, redacted by stage. Real name/photo are never in a snapshot —
 * they surface only in DM after a mutual match. Camera is published ONLY at the FACE stage
 * (privacy boundary = publish permission, not UI). See `apps/backend/src/speed-date/`.
 */

/** Progressive reveal stages. */
export type SpeedDateStage = "DISGUISED" | "VOICE" | "FACE";

/** Session lifecycle phases held in `state.phase`. */
export type SpeedDatePhase = "preflight" | "round" | "intermission" | "decision" | "ended";

/** What the current stage reveals about a partner's media. Single source of truth. */
export interface StageReveal {
  /** true = partner publishes camera (face visible); false = static avatar image. */
  video: boolean;
  /** true = partner audio is pitch-modulated (disguised). */
  voiceMod: boolean;
}

/**
 * A partner as seen by a viewer in the current round — redacted per stage.
 * Never carries real name or photo; those surface only in DM after a mutual match.
 */
export interface PartnerView {
  profileId: string;
  nickname: string;
  gender: string;
  /** Static character-image id (avatar), shown whenever `video` is false. */
  avatarId: string;
  video: boolean;
  voiceMod: boolean;
  /** true when this slot is AI-filled (dev only; no real media published). */
  isAi?: boolean;
}

/** The viewer's current 1:1 LiveKit room assignment. null between rounds. */
export interface SpeedDateRoomInfo {
  /** LiveKit room name for this pair+round (deterministic, private to the two). */
  room: string;
  /** LiveKit server URL (ws[s]://...). */
  url: string;
  /** Short-lived access token scoped to `room` for the viewer's identity. */
  token: string;
  /** Whether the viewer should publish camera this stage (FACE only). */
  publishVideo: boolean;
}

/** Mutual-match results for THIS viewer only (set when phase === "ended"). */
export interface SpeedDateResultView {
  matches: Array<{ profileId: string; nickname: string; roomId: string }>;
}

/** Per-viewer projection of a speed-date session. */
export interface SpeedDateSnapshot {
  sessionId: string;
  phase: SpeedDatePhase;
  /** Current reveal stage; null in preflight/decision/ended. */
  stage: SpeedDateStage | null;
  stageIndex: number;
  stageCount: number;
  roundIndex: number;
  roundCount: number;
  /** epoch ms deadline of the current phase (server-authoritative; client clock display-only). */
  phaseEndsAt: number;
  myProfileId: string;
  myNickname: string;
  myGender: string;
  /** The viewer's partner this round; null unless phase === "round". */
  partner: PartnerView | null;
  /** LiveKit room for this round; null when no active round. Reconnect keys on `room.room`. */
  room: SpeedDateRoomInfo | null;
  /** Opposite-gender partners the viewer has met so far (the decision grid). */
  metPartners: PartnerView[];
  /** The viewer's own private choices (profileIds they want to keep talking to). */
  myChoices: string[];
  /** Set only when phase === "ended": the viewer's mutual matches. */
  result: SpeedDateResultView | null;
}

/** speeddate:snapshot payload; snapshot null = no active session (sync response). */
export interface SpeedDateSnapshotEvent {
  sessionId: string;
  snapshot: SpeedDateSnapshot | null;
}

/** Queue status for the matching phase (before a session forms). */
export type SpeedDateQueueStatus = "idle" | "waiting" | "matched";

export interface SpeedDateStatus {
  status: SpeedDateQueueStatus;
  /** Present when matched: the session to join. */
  sessionId: string | null;
  /** Present when waiting: epoch ms the entry was enqueued. */
  since: number | null;
}
