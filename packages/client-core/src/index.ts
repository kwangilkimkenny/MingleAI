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

export { getMyProfile, createProfile } from "./api/profiles.js";
export type { CreateProfileInput } from "./api/profiles.js";

export { enqueueMatchmaking, cancelMatchmaking, getMatchmakingStatus } from "./api/matchmaking.js";
export type {
  MatchmakingQueueStatus,
  MatchmakingQueueEntry,
  PublicPartyParticipant,
  PublicParty,
  MatchmakingStatus,
} from "@mingle/shared";
