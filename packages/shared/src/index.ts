export type { Profile } from "./types/profile.js";

export type {
  PartyStatus,
  Party,
  PartyMessageView,
  PartyPresence,
  PartyMove,
  GameChoice,
  GameReveal,
  GameSnapshot,
  GameStateEvent,
} from "./types/party.js";

export { preferenceScore, DEFAULT_WEIGHTS } from "./matchmaking/score.js";
export type { ScoreWeights } from "./matchmaking/score.js";
export type {
  MatchmakingQueueStatus,
  MatchmakingQueueEntry,
  PublicPartyParticipant,
  PublicParty,
  MatchmakingStatus,
} from "./matchmaking/types.js";

export type {
  ProposalStatus,
  Proposal,
  Match,
  Block,
  DirectMessageRoom,
  DirectMessage,
  PeerProfile,
  MatchSummary,
  ProposalView,
  NewMessageEvent,
  ReadEvent,
  TypingEvent,
} from "./types/social.js";
export { normalizeMatchPair, blockPairKey } from "./social/pair.js";
export { haversineKm, withinMutualRadius } from "./geo/distance.js";
export type { Coords } from "./geo/distance.js";

export type { PartyMessage, GameSessionStatus, GameSession } from "./types/messaging.js";

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

export type {
  AmongRole,
  AmongPhase,
  AmongTaskKind,
  AmongTaskView,
  AmongPlayerView,
  AmongBodyView,
  AmongMeetingView,
  AmongResultView,
  AmongSnapshot,
  AmongStateEvent,
} from "./types/among.js";

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

export {
  PARTY_MAP,
  WORLD_ASPECT,
  CHAR_R,
  ROOM_MARGIN,
  PARTY_MOVE_SPEED,
  BALANCE_STATION_ID,
  isSolid,
  solidFurniture,
  worldDist,
  partySpawnFor,
  isPartyPositionWalkable,
  isPlausiblePartyMove,
} from "./party-map/map.js";
export type {
  FurnitureKind,
  FurnitureDef,
  DecoKind,
  DecoDef,
  StationDef,
  RoomDef,
  WallDef,
  PartyMapDef,
} from "./party-map/map.js";
