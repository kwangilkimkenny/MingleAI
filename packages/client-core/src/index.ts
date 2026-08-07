export {
  configureClient,
  getClientConfig,
  setTokenAccessor,
  getToken,
} from "./config.js";
export type { ClientConfig } from "./config.js";

export { createMemoryStorage } from "./storage.js";
export type { KeyValueStorage } from "./storage.js";

export { createAuthStore } from "./auth-store.js";
export type { AuthState, UserRole } from "./auth-store.js";

export { apiFetch, ApiError } from "./api/client.js";

export {
  getSocialProviders,
  socialLogin,
  devLogin,
  getAccountStatus,
  submitConsents,
  startIdentityVerification,
  completeIdentityVerification,
  refreshSession,
  logoutSession,
  deleteAccount,
} from "./api/auth.js";
export type { AuthResponse, IdentityPayload } from "./api/auth.js";
export {
  REQUIRED_CONSENTS,
  CONSENT_VERSION,
  nextGate,
} from "@mingle/shared";
export type {
  AuthProvider,
  ConsentScope,
  AccountStatus,
  PermissionState,
  GateStep,
} from "@mingle/shared";

export { getMyProfile, createProfile, updateProfile, uploadPhoto } from "./api/profiles.js";
export {
  VIBE_OPTIONS,
  PACE_OPTIONS,
  DRINKING_OPTIONS,
  ACTIVITY_OPTIONS,
  MIN_ACTIVITIES,
  MAX_ACTIVITIES,
  MAX_NOTE_LENGTH,
  describePreferences,
  answersFromSignals,
} from "@mingle/shared";
export type { PreferenceOption, PreferenceAnswers, PreferenceSignals } from "@mingle/shared";
export type { CreateProfileInput, UpdateProfileInput, UploadPhotoFile } from "./api/profiles.js";

export { getMatches } from "./api/matches.js";

export { getRoomMessages, sendMessage, markRoomRead, suggestReplies } from "./api/messenger.js";

export { createBlock, getBlocks, removeBlock } from "./api/blocks.js";

export { reportUser, REPORT_REASONS } from "./api/reports.js";
export type { ReportReason, ReportInput } from "./api/reports.js";

export { registerDevice, unregisterDevice, setPushEnabled, getPushEnabled } from "./api/devices.js";
export {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "./api/notifications.js";
export type { AppNotification } from "./api/notifications.js";

export {
  createDatePlan,
  getDatePlan,
  getDatePlansForMatch,
  selectCourse,
  confirmDatePlan,
  cancelDatePlan,
  completeDatePlan,
} from "./api/date-plans.js";
export type { CreateDatePlanInput } from "./api/date-plans.js";

export { connectMessengerSocket } from "./socket/messenger-socket.js";
export type {
  MessengerSocketHandlers,
  MessengerSocketHandle,
} from "./socket/messenger-socket.js";

export { enqueueSpeedDate, cancelSpeedDate, getSpeedDateStatus } from "./api/speed-date.js";
export type { SpeedDateEnqueueOptions } from "./api/speed-date.js";
export { getNearbyPlaces, searchAreas } from "./api/places.js";
export type { NaverPlace, AreaHit } from "./api/places.js";
export { connectSpeedDateSocket } from "./socket/speed-date-socket.js";
export type {
  SpeedDateSocketHandlers,
  SpeedDateSocketHandle,
} from "./socket/speed-date-socket.js";
export type {
  SpeedDateStage,
  SpeedDatePhase,
  PartnerView,
  SpeedDateRoomInfo,
  SpeedDateResultView,
  SpeedDateSnapshot,
  SpeedDateSnapshotEvent,
  SpeedDateQueueStatus,
  SpeedDateStatus,
} from "@mingle/shared";

export type {
  MatchSummary,
  PeerProfile,
  DirectMessageRoom,
  DirectMessage,
  NewMessageEvent,
  ReadEvent,
  TypingEvent,
} from "@mingle/shared";
