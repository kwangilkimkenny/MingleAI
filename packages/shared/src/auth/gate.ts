/**
 * Onboarding gate — the ordered set of requirements every account must satisfy before it can
 * use the app. The same ladder is enforced client-side (redirect) and server-side (VerifiedGuard):
 * social auth → consent → camera/mic permission → real-name identity → profile → ready.
 */

export type AuthProvider = "kakao" | "naver" | "google" | "dev" | "local";

/** Consent scopes recorded server-side (camera/mic are OS permissions, not stored). */
export type ConsentScope = "terms" | "privacy" | "age19";

/** All consents required before service use. */
export const REQUIRED_CONSENTS: readonly ConsentScope[] = ["terms", "privacy", "age19"];

/** Single source of truth for the consent document version stamped on each grant. */
export const CONSENT_VERSION = "2026-07-22";

/** Server-reported account gate status (from GET /auth/account-status). */
export interface AccountStatus {
  provider: AuthProvider;
  phoneVerifiedAt: string | null;
  consents: Record<ConsentScope, boolean>;
  hasProfile: boolean;
}

/** OS-level permission grants the client checks locally. */
export interface PermissionState {
  camera: boolean;
  microphone: boolean;
}

/** The next unmet gate step; "ready" means the account may enter the app. */
export type GateStep = "consent" | "permissions" | "identity" | "profile" | "ready";

/**
 * Resolve the next gate the account must clear. Pure. Order is fixed: consent first (legal),
 * then camera/mic permission (hard block), then real-name identity, then profile.
 */
export function nextGate(status: AccountStatus, perms: PermissionState): GateStep {
  if (!REQUIRED_CONSENTS.every((s) => status.consents[s])) return "consent";
  if (!perms.camera || !perms.microphone) return "permissions";
  if (!status.phoneVerifiedAt) return "identity";
  if (!status.hasProfile) return "profile";
  return "ready";
}
