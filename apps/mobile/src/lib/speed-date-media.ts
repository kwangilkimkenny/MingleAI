import type { SpeedDateRoomInfo } from "@mingle/client-core";

/**
 * Media seam for the blind speed date. The session UI (matching, rotation, reveal stages,
 * decision, result) is driven by the socket snapshot; this seam adds the live WebRTC layer.
 *
 * - Web (`speed-date-media.web.ts`): real LiveKit via `livekit-client` — publishes camera (FACE)
 *   + mic, exposes the remote partner's video and the local self-view track.
 * - Native (this file): avatar-only fallback until `@livekit/react-native` is wired in an EAS
 *   dev build (see the runbook). Returns no tracks so the screen renders avatars.
 */
export type SpeedDateMediaStatus = "idle" | "connecting" | "connected" | "unavailable";

export interface SpeedDateMedia {
  status: SpeedDateMediaStatus;
  /** True when a remote partner video track is present (FACE stage, both cameras on). */
  hasRemoteVideo: boolean;
  /** Remote partner's video track (MediaStreamTrack on web); null in the avatar-only fallback. */
  remoteVideoTrack: unknown | null;
  /** The viewer's own camera track for the self-view PiP; null in the avatar-only fallback. */
  localVideoTrack: unknown | null;
}

export function useSpeedDateMedia(
  _room: SpeedDateRoomInfo | null,
  _publishVideo: boolean,
): SpeedDateMedia {
  return { status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null };
}
