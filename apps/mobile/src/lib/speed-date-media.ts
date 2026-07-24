import { useEffect, useRef, useState } from "react";
import type { SpeedDateRoomInfo } from "@mingle/client-core";

/**
 * Media seam for the blind speed date. The session UI (matching, rotation, reveal stages,
 * decision, result) is driven by the socket snapshot; this seam adds the live WebRTC layer.
 *
 * - Web (`speed-date-media.web.ts`): LiveKit via `livekit-client` — publishes a pitch-shifted mic
 *   (DISGUISED) or the raw mic, camera at FACE, and exposes remote/local MediaStreamTracks.
 * - Native (this file): LiveKit via `@livekit/react-native` (guarded require — Expo Go / builds
 *   without the native module fall back to avatar-only). After `registerGlobals()` the plain
 *   `livekit-client` Room API works in RN; tracks exposed here are livekit-client VideoTrack
 *   objects, rendered by the native `VideoView`.
 *
 * ⚠️ Native voice disguise: RN has no Web Audio, so the DISGUISED pitch-shift is not available
 * (Phase E spike = native DSP). To keep the "가면" privacy promise the native mic is MUTED during
 * DISGUISED instead of leaking the raw voice. Flip to "raw" only as a deliberate product call.
 */
const DISGUISED_NATIVE_MIC: "mute" | "raw" = "mute";

export type SpeedDateMediaStatus = "idle" | "connecting" | "connected" | "unavailable";

export interface SpeedDateMedia {
  status: SpeedDateMediaStatus;
  /** True when a remote partner video track is present (FACE stage, both cameras on). */
  hasRemoteVideo: boolean;
  /** Remote partner's video track (platform-specific object); null in the avatar-only fallback. */
  remoteVideoTrack: unknown | null;
  /** The viewer's own camera track for the self-view PiP; null in the avatar-only fallback. */
  localVideoTrack: unknown | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let globalsReady: boolean | null = null;
/** Load @livekit/react-native + registerGlobals once; false when the native module is absent. */
function ensureLiveKit(): { lk: any; client: any } | null {
  if (globalsReady === false) return null;
  try {
    const lk = require("@livekit/react-native");
    if (!globalsReady) {
      lk.registerGlobals();
      globalsReady = true;
    }
    const client = require("livekit-client");
    return { lk, client };
  } catch {
    globalsReady = false;
    return null;
  }
}

export function useSpeedDateMedia(
  roomInfo: SpeedDateRoomInfo | null,
  publishVideo: boolean,
  modulateVoice: boolean,
): SpeedDateMedia {
  const [media, setMedia] = useState<SpeedDateMedia>({
    status: "idle",
    hasRemoteVideo: false,
    remoteVideoTrack: null,
    localVideoTrack: null,
  });
  const roomRef = useRef<any>(null);
  const lkRef = useRef<any>(null);
  const modRef = useRef(modulateVoice);
  modRef.current = modulateVoice;

  useEffect(() => {
    if (!roomInfo?.url || !roomInfo?.token) {
      setMedia({ status: "idle", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null });
      return;
    }
    const env = ensureLiveKit();
    if (!env) {
      // Native module not in this build (Expo Go / web bundle) — avatar-only fallback.
      setMedia({ status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null });
      return;
    }
    const { lk, client } = env;
    lkRef.current = lk;
    const room = new client.Room();
    roomRef.current = room;
    let cancelled = false;

    const sync = () => {
      let remote: unknown | null = null;
      room.remoteParticipants.forEach((p: any) => {
        const pub = p.getTrackPublication(client.Track.Source.Camera);
        if (pub?.videoTrack) remote = pub.videoTrack;
      });
      const localPub = room.localParticipant.getTrackPublication(client.Track.Source.Camera);
      const local = localPub?.videoTrack ?? null;
      setMedia({ status: "connected", hasRemoteVideo: !!remote, remoteVideoTrack: remote, localVideoTrack: local });
    };

    (async () => {
      setMedia((m) => ({ ...m, status: "connecting" }));
      await lk.AudioSession.startAudioSession();
      await room.connect(roomInfo.url, roomInfo.token);
      if (cancelled) return void room.disconnect();
      // No native pitch-shift (Phase E): keep the disguise by muting instead of leaking raw voice.
      const micOn = DISGUISED_NATIVE_MIC === "raw" || !modRef.current;
      await room.localParticipant.setMicrophoneEnabled(micOn);
      await room.localParticipant.setCameraEnabled(publishVideo);
      const E = client.RoomEvent;
      room
        .on(E.TrackSubscribed, sync)
        .on(E.TrackUnsubscribed, sync)
        .on(E.LocalTrackPublished, sync)
        .on(E.LocalTrackUnpublished, sync)
        .on(E.ParticipantConnected, sync)
        .on(E.ParticipantDisconnected, sync);
      sync();
    })().catch((e) => {
      console.warn("[speed-date] native livekit connect failed:", e);
      if (!cancelled)
        setMedia({ status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null });
    });

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      void lk.AudioSession.stopAudioSession();
    };
    // Reconnect only when the ROOM changes; publishVideo/modulateVoice apply live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomInfo?.room]);

  // Camera follows the stage's publish permission (server-enforced via token grant).
  useEffect(() => {
    const room = roomRef.current;
    if (room && room.state === "connected") void room.localParticipant.setCameraEnabled(publishVideo);
  }, [publishVideo]);

  // Mic mute follows the disguise stage (see DISGUISED_NATIVE_MIC above).
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    const micOn = DISGUISED_NATIVE_MIC === "raw" || !modulateVoice;
    void room.localParticipant.setMicrophoneEnabled(micOn);
  }, [modulateVoice]);

  return media;
}
