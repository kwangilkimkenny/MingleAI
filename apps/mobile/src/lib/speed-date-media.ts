import type { SpeedDateRoomInfo } from "@mingle/client-core";

/**
 * Media seam for the blind speed date. The session UI (matching, rotation, reveal stages,
 * decision, result) is fully driven by the socket snapshot and does NOT depend on the video
 * transport — it renders the partner's avatar image whenever no live remote video is present.
 *
 * This is the SINGLE integration point for real WebRTC. The default returns "unavailable"
 * so the app bundles and runs (web / Expo Go / tests) without the native LiveKit module. To
 * enable real video, install `@livekit/react-native` + `@livekit/react-native-webrtc`, do an
 * EAS dev build, and replace `useSpeedDateMedia` with a LiveKit implementation that:
 *   1. connects to `room.url` with `room.token` when `room` is non-empty,
 *   2. publishes microphone always and camera only when `room.publishVideo` is true,
 *   3. exposes the remote participant's video track for the screen to render,
 *   4. tears down on room change / unmount.
 * See docs/qa/*speed-date* runbook for the full drop-in. Everything else stays unchanged.
 */
export type SpeedDateMediaStatus = "idle" | "connecting" | "connected" | "unavailable";

export interface SpeedDateMedia {
  status: SpeedDateMediaStatus;
  /** True when a real remote video track is being rendered (FACE stage, both cameras on). */
  hasRemoteVideo: boolean;
  /** Opaque handle the LiveKit renderer consumes; null in the avatar-only default. */
  remoteVideoTrack: unknown | null;
}

/**
 * Default: no media transport wired. The screen falls back to avatar/placeholder rendering.
 * `room` and `publishVideo` are accepted so the LiveKit drop-in has the same signature.
 */
export function useSpeedDateMedia(
  _room: SpeedDateRoomInfo | null,
  _publishVideo: boolean,
): SpeedDateMedia {
  return { status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null };
}
