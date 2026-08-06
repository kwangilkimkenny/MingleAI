export type { Profile } from "./types/profile.js";

export { preferenceScore, DEFAULT_WEIGHTS } from "./matchmaking/score.js";
export type { ScoreWeights } from "./matchmaking/score.js";
export type {
  Match,
  Block,
  DirectMessageRoom,
  DirectMessage,
  PeerProfile,
  MatchSummary,
  NewMessageEvent,
  ReadEvent,
  TypingEvent,
} from "./types/social.js";
export { normalizeMatchPair, blockPairKey } from "./social/pair.js";
export { haversineKm, withinMutualRadius } from "./geo/distance.js";
export type { Coords } from "./geo/distance.js";

export type {
  SafetyContext,
  ViolationType,
  ViolationSeverity,
  Violation,
  SafetyResult,
  SafetyReportReason,
  SafetyReportStatus,
  SafetyReport,
} from "./types/safety.js";

export type {
  DateConstraints,
  DateStop,
  DateCourse,
  DatePlanStatus,
  DatePlan,
  DatePlanView,
} from "./types/date-plan.js";

export type {
  PreferenceVibe,
  PreferenceDrinking,
  PreferencePace,
  PreferenceSignals,
} from "./types/preference.js";
export {
  VIBE_OPTIONS,
  PACE_OPTIONS,
  DRINKING_OPTIONS,
  ACTIVITY_OPTIONS,
  MIN_ACTIVITIES,
  MAX_ACTIVITIES,
  MAX_NOTE_LENGTH,
  describePreferences,
  buildPreferenceSignals,
  answersFromSignals,
} from "./preference/catalog.js";
export type { PreferenceOption, PreferenceAnswers } from "./preference/catalog.js";

export type {
  SpeedDateStage,
  SpeedDatePhase,
  StageReveal,
  PartnerView,
  SpeedDateRoomInfo,
  SpeedDateResultView,
  SpeedDateSnapshot,
  SpeedDateSnapshotEvent,
  SpeedDateQueueStatus,
  SpeedDateStatus,
} from "./types/speed-date.js";
export {
  REQUIRED_CONSENTS,
  CONSENT_VERSION,
  nextGate,
} from "./auth/gate.js";
export type {
  AuthProvider,
  ConsentScope,
  AccountStatus,
  PermissionState,
  GateStep,
} from "./auth/gate.js";

export { buildRotationSchedule } from "./speed-date/schedule.js";
export { stageReveal, projectPartner } from "./speed-date/projection.js";
export type { PartnerIdentity } from "./speed-date/projection.js";
