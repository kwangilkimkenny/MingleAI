import type { SpeedDateStage, StageReveal, PartnerView } from "../types/speed-date.js";

/**
 * Media reveal policy for a stage — the single source of truth for what a partner's
 * camera/voice expose. Camera is published ONLY at FACE; voice is modulated ONLY at
 * DISGUISED. The backend uses this to decide LiveKit publish grants (the privacy
 * boundary is the publish permission, not the UI).
 */
export function stageReveal(stage: SpeedDateStage): StageReveal {
  switch (stage) {
    case "DISGUISED":
      return { video: false, voiceMod: true };
    case "VOICE":
      return { video: false, voiceMod: false };
    case "FACE":
      return { video: true, voiceMod: false };
  }
}

/** Minimal identity the server holds for a session participant. */
export interface PartnerIdentity {
  profileId: string;
  nickname: string;
  gender: string;
  avatarId: string;
  isAi?: boolean;
}

/**
 * Redact a partner's identity for the given stage. Never includes real name or photo —
 * those surface only in DM after a mutual match. Whitelist projection: only the fields
 * below are ever emitted, so adding sensitive columns to the server state cannot leak.
 */
export function projectPartner(stage: SpeedDateStage, partner: PartnerIdentity): PartnerView {
  const reveal = stageReveal(stage);
  const view: PartnerView = {
    profileId: partner.profileId,
    nickname: partner.nickname,
    gender: partner.gender,
    avatarId: partner.avatarId,
    video: reveal.video,
    voiceMod: reveal.voiceMod,
  };
  if (partner.isAi) view.isAi = true;
  return view;
}
