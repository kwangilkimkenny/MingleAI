import {
  buildRotationSchedule,
  projectPartner,
  stageReveal,
  type PartnerView,
  type SpeedDatePhase,
  type SpeedDateSnapshot,
  type SpeedDateStage,
} from "@mingle/shared";
import type { SpeedDateConfig } from "./speed-date.config";

/** A session participant as held server-side (never sent to clients wholesale). */
export interface SpeedDateParticipant {
  profileId: string;
  gender: string; // male | female
  nickname: string;
  avatarId: string;
  isAi: boolean;
}

export interface SpeedDateResult {
  matches: Array<{ a: string; b: string; matchId: string; roomId: string }>;
}

/** Authoritative session state, persisted as `SpeedDateSession.state` JSON. */
export interface SpeedDateState {
  phase: SpeedDatePhase;
  stageIndex: number;
  roundIndex: number;
  /** epoch ms deadline of the current phase. */
  phaseEndsAt: number;
  /** monotonic; bumped on every transition (idempotency / reconnect ordering). */
  sequence: number;
  stageOrder: SpeedDateStage[];
  participants: SpeedDateParticipant[];
  males: string[];
  females: string[];
  /** schedule[round][pair] = [maleId, femaleId]; reused across every stage. */
  schedule: [string, string][][];
  /** chooserProfileId → profileIds they want to keep talking to (private). */
  choices: Record<string, string[]>;
  result?: SpeedDateResult;
}

/** Timing config needed to advance phases. */
type PhaseCfg = Pick<
  SpeedDateConfig,
  "preflightMs" | "stageIntroMs" | "roundMs" | "intermissionMs" | "decisionMs"
>;

export function createInitialState(
  participants: SpeedDateParticipant[],
  males: string[],
  females: string[],
  cfg: SpeedDateConfig,
  now: number,
): SpeedDateState {
  return {
    phase: "preflight",
    stageIndex: 0,
    roundIndex: 0,
    phaseEndsAt: now + cfg.preflightMs,
    sequence: 0,
    stageOrder: cfg.stageOrder,
    participants,
    males,
    females,
    schedule: buildRotationSchedule(males, females),
    choices: {},
  };
}

function roundCount(state: SpeedDateState): number {
  return state.schedule.length;
}

function isLastPosition(state: SpeedDateState): boolean {
  return (
    state.stageIndex === state.stageOrder.length - 1 &&
    state.roundIndex === roundCount(state) - 1
  );
}

/**
 * Advance the session when the current phase's deadline has passed. Pure: returns a new
 * state (does not mutate) or null if no transition is due (deadline not reached, or ended).
 * Resolution of the decision (creating Matches) is I/O and handled by the service when this
 * returns a state whose phase is "ended".
 */
export function nextPhase(
  state: SpeedDateState,
  now: number,
  cfg: PhaseCfg,
): SpeedDateState | null {
  if (state.phase === "ended") return null;
  if (now < state.phaseEndsAt) return null;

  const next: SpeedDateState = structuredClone(state);
  next.sequence = state.sequence + 1;

  switch (state.phase) {
    case "preflight":
      // Join window over → announce the first stage ("1라운드") before its first round.
      next.phase = "stage_intro";
      next.stageIndex = 0;
      next.roundIndex = 0;
      next.phaseEndsAt = now + cfg.stageIntroMs;
      break;
    case "stage_intro":
      // Countdown over → begin the stage's first rotation (indices unchanged).
      next.phase = "round";
      next.phaseEndsAt = now + cfg.roundMs;
      break;
    case "round":
      if (isLastPosition(state)) {
        next.phase = "decision";
        next.phaseEndsAt = now + cfg.decisionMs;
      } else if (state.roundIndex === roundCount(state) - 1) {
        // Last rotation of this stage, more stages remain → announce the next stage.
        next.phase = "stage_intro";
        next.stageIndex = state.stageIndex + 1;
        next.roundIndex = 0;
        next.phaseEndsAt = now + cfg.stageIntroMs;
      } else {
        // More partners in this stage → brief switch to the next rotation.
        next.phase = "intermission";
        next.phaseEndsAt = now + cfg.intermissionMs;
      }
      break;
    case "intermission":
      // Intra-stage rotation only (stage transitions go through stage_intro above).
      next.roundIndex = state.roundIndex + 1;
      next.phase = "round";
      next.phaseEndsAt = now + cfg.roundMs;
      break;
    case "decision":
      next.phase = "ended";
      next.phaseEndsAt = now;
      break;
  }
  return next;
}

function partById(state: SpeedDateState, id: string): SpeedDateParticipant | undefined {
  return state.participants.find((p) => p.profileId === id);
}

/** The viewer's partner id in a given round, or null if unpaired that round. */
function partnerIdInRound(
  state: SpeedDateState,
  round: number,
  viewerId: string,
): string | null {
  const pair = state.schedule[round]?.find(([m, f]) => m === viewerId || f === viewerId);
  if (!pair) return null;
  return pair[0] === viewerId ? pair[1] : pair[0];
}

/** The viewer's current live pairing (only during a "round" phase). */
export function currentPair(
  state: SpeedDateState,
  viewerId: string,
): { partnerId: string; pairIndex: number; stage: SpeedDateStage; publishVideo: boolean } | null {
  if (state.phase !== "round") return null;
  const round = state.schedule[state.roundIndex];
  const pairIndex = round?.findIndex(([m, f]) => m === viewerId || f === viewerId) ?? -1;
  if (pairIndex < 0) return null;
  const partnerId = partnerIdInRound(state, state.roundIndex, viewerId);
  if (!partnerId) return null;
  const stage = state.stageOrder[state.stageIndex];
  return { partnerId, pairIndex, stage, publishVideo: stageReveal(stage).video };
}

/** Distinct opposite-gender partners the viewer has met up to (and including) the current round. */
export function metPartnerIds(state: SpeedDateState, viewerId: string): string[] {
  // No partners met yet during the initial wait, nor leak the upcoming one during a stage intro.
  if (state.phase === "preflight" || state.phase === "stage_intro") return [];
  const rc = roundCount(state);
  const current = state.stageIndex * rc + state.roundIndex;
  const met = new Set<string>();
  for (let pos = 0; pos <= current; pos++) {
    const partnerId = partnerIdInRound(state, pos % rc, viewerId);
    if (partnerId) met.add(partnerId);
  }
  return [...met];
}

function projectView(
  state: SpeedDateState,
  partnerId: string,
  stage: SpeedDateStage,
): PartnerView | null {
  const p = partById(state, partnerId);
  if (!p) return null;
  return projectPartner(stage, {
    profileId: p.profileId,
    nickname: p.nickname,
    gender: p.gender,
    avatarId: p.avatarId,
    isAi: p.isAi,
  });
}

/**
 * Per-viewer projection. Reveals only the viewer's current partner (redacted per stage),
 * the opposite-gender people they've met, their own private choices, and — once ended —
 * their own mutual matches. The LiveKit room+token is filled in by the gateway (I/O).
 */
export function snapshotFor(
  sessionId: string,
  state: SpeedDateState,
  viewerId: string,
  now: number = Date.now(),
): SpeedDateSnapshot {
  const me = partById(state, viewerId);
  // Expose the current stage during its intro too, so the "N라운드" screen can show the reveal.
  const inSession =
    state.phase === "round" || state.phase === "intermission" || state.phase === "stage_intro";
  const stage = inSession ? state.stageOrder[state.stageIndex] : null;

  let partner: PartnerView | null = null;
  if (state.phase === "round") {
    const cp = currentPair(state, viewerId);
    if (cp) partner = projectView(state, cp.partnerId, cp.stage);
  }

  const effStage = state.stageOrder[Math.min(state.stageIndex, state.stageOrder.length - 1)];
  const metPartners = metPartnerIds(state, viewerId)
    .map((id) => projectView(state, id, effStage))
    .filter((v): v is PartnerView => v !== null);

  let result: SpeedDateSnapshot["result"] = null;
  if (state.phase === "ended" && state.result) {
    result = {
      matches: state.result.matches
        .filter((m) => m.a === viewerId || m.b === viewerId)
        .map((m) => {
          const otherId = m.a === viewerId ? m.b : m.a;
          return { profileId: otherId, nickname: partById(state, otherId)?.nickname ?? "", roomId: m.roomId };
        }),
    };
  }

  return {
    sessionId,
    phase: state.phase,
    stage,
    stageIndex: state.stageIndex,
    stageCount: state.stageOrder.length,
    roundIndex: state.roundIndex,
    roundCount: roundCount(state),
    phaseEndsAt: state.phaseEndsAt,
    serverNow: now,
    myProfileId: viewerId,
    myNickname: me?.nickname ?? "",
    myGender: me?.gender ?? "",
    partner,
    room: null,
    metPartners,
    myChoices: state.choices[viewerId] ?? [],
    result,
  };
}

/** Unordered opposite-gender pairs where both participants privately chose each other. */
export function mutualPairs(state: SpeedDateState): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const m of state.males) {
    for (const f of state.females) {
      const mChoseF = (state.choices[m] ?? []).includes(f);
      const fChoseM = (state.choices[f] ?? []).includes(m);
      if (mChoseF && fChoseM) pairs.push([m, f]);
    }
  }
  return pairs;
}

/** Whether two participants are on opposite sides of the 3×3 pairing (a valid choice target). */
export function isOppositeGender(state: SpeedDateState, a: string, b: string): boolean {
  return (
    (state.males.includes(a) && state.females.includes(b)) ||
    (state.females.includes(a) && state.males.includes(b))
  );
}
