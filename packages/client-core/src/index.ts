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

export { register, login } from "./api/auth.js";
export type { AuthResponse } from "./api/auth.js";

export { getMyProfile, createProfile, updateProfile, uploadPhoto } from "./api/profiles.js";
export type { CreateProfileInput, UpdateProfileInput, UploadPhotoFile } from "./api/profiles.js";

export { enqueueMatchmaking, cancelMatchmaking, getMatchmakingStatus } from "./api/matchmaking.js";
export type {
  MatchmakingQueueStatus,
  MatchmakingQueueEntry,
  PublicPartyParticipant,
  PublicParty,
  MatchmakingStatus,
} from "@mingle/shared";

export {
  sendProposal,
  getReceivedProposals,
  getSentProposals,
  acceptProposal,
  declineProposal,
} from "./api/proposals.js";

export { getMatches } from "./api/matches.js";

export { getRoomMessages, sendMessage, markRoomRead } from "./api/messenger.js";

export { createBlock, getBlocks, removeBlock } from "./api/blocks.js";

export { reportUser, REPORT_REASONS } from "./api/reports.js";
export type { ReportReason, ReportInput } from "./api/reports.js";

export { registerDevice, unregisterDevice, setPushEnabled } from "./api/devices.js";
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
} from "./api/date-plans.js";
export type { CreateDatePlanInput } from "./api/date-plans.js";

export { connectMessengerSocket } from "./socket/messenger-socket.js";
export type {
  MessengerSocketHandlers,
  MessengerSocketHandle,
} from "./socket/messenger-socket.js";

export { getPartyMessages } from "./api/party.js";
export { connectPartySocket } from "./socket/party-socket.js";
export type { PartySocketHandlers, PartySocketHandle } from "./socket/party-socket.js";

export type {
  Proposal,
  ProposalView,
  ProposalStatus,
  MatchSummary,
  PeerProfile,
  DirectMessageRoom,
  DirectMessage,
  NewMessageEvent,
  ReadEvent,
  TypingEvent,
} from "@mingle/shared";
export type {
  PartyMessageView,
  PartyPresence,
  PartyMove,
  GameSnapshot,
  GameReveal,
  GameChoice,
  GameStateEvent,
} from "@mingle/shared";
