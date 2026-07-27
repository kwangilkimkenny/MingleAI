/**
 * Onboarding gate — the ordered set of requirements every account must satisfy before it can
 * use the app. The same ladder is enforced client-side (redirect) and server-side (VerifiedGuard):
 * social auth → real-name identity → consent → camera/mic permission → profile → ready.
 * (2026-07-27 지시: 본인인증 먼저 — 인증이 나이를 제공하므로 만19세 체크 동의는 없앴다.)
 */

export type AuthProvider = "kakao" | "naver" | "google" | "dev" | "local";

/** Consent scopes recorded server-side (camera/mic are OS permissions, not stored).
 *  "age19" is legacy — age is now guaranteed by identity verification, not a checkbox. */
export type ConsentScope = "terms" | "privacy" | "age19";

/** All consents required before service use. */
export const REQUIRED_CONSENTS: readonly ConsentScope[] = ["terms", "privacy"];

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
 * Resolve the next gate the account must clear. Pure. Order is fixed: real-name identity first
 * (provides verified age/gender), then consent (legal), then camera/mic permission (hard block),
 * then profile.
 */
export function nextGate(status: AccountStatus, perms: PermissionState): GateStep {
  if (!status.phoneVerifiedAt) return "identity";
  if (!REQUIRED_CONSENTS.every((s) => status.consents[s])) return "consent";
  if (!perms.camera || !perms.microphone) return "permissions";
  if (!status.hasProfile) return "profile";
  return "ready";
}
