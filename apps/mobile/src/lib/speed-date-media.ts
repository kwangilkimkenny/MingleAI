import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { SpeedDateRoomInfo } from "@mingle/client-core";
import { setNativeVoiceDisguiseEnabled } from "./native-voice-disguise";

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
 * Android DISGUISED audio is processed publisher-side by the pinned LiveKit PCM processor. Any
 * setup failure is fail-closed: the microphone stays unpublished instead of exposing raw speech.
 */

export type SpeedDateMediaStatus = "idle" | "connecting" | "connected" | "unavailable";

export interface SpeedDateMedia {
  status: SpeedDateMediaStatus;
  /** Actual outgoing microphone state after privacy-stage policy and the user's mute choice. */
  microphoneEnabled: boolean;
  /** Actual outgoing camera state after the server stage policy and the user's camera choice. */
  cameraEnabled: boolean;
  /** Native disguise currently protects the raw voice by locking the mic off. */
  canToggleMicrophone: boolean;
  /** Camera can only be controlled in the server-authorized FACE stage. */
  canToggleCamera: boolean;
  /** True when a remote partner video track is present (FACE stage, both cameras on). */
  hasRemoteVideo: boolean;
  /** Remote partner's video track (platform-specific object); null in the avatar-only fallback. */
  remoteVideoTrack: unknown | null;
  /** The viewer's own camera track for the self-view PiP; null in the avatar-only fallback. */
  localVideoTrack: unknown | null;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
let globalsReady: boolean | null = null;

/** Android emulators reach services on the development host through 10.0.2.2, not localhost. */
export function reachableLiveKitUrl(url: string): string {
  if (Platform.OS !== "android") return url;
  return url.replace(/^(wss?:\/\/)(?:localhost|127\.0\.0\.1)(?=[:/]|$)/, "$110.0.2.2");
}

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
    microphoneEnabled: false,
    cameraEnabled: false,
    canToggleMicrophone: false,
    canToggleCamera: false,
    hasRemoteVideo: false,
    remoteVideoTrack: null,
    localVideoTrack: null,
    setMicrophoneEnabled: async () => {},
    setCameraEnabled: async () => {},
  });
  const roomRef = useRef<any>(null);
  const lkRef = useRef<any>(null);
  const modRef = useRef(modulateVoice);
  modRef.current = modulateVoice;
  const userMicRef = useRef(true);
  const userCameraRef = useRef(true);
  const disguiseReadyRef = useRef(false);

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    userMicRef.current = enabled;
    const room = roomRef.current;
    const allowedByPrivacy = !modRef.current || disguiseReadyRef.current;
    const actual = enabled && allowedByPrivacy;
    if (room?.state === "connected") await room.localParticipant.setMicrophoneEnabled(actual);
    setMedia((m) => ({ ...m, microphoneEnabled: actual }));
  }, []);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    userCameraRef.current = enabled;
    const room = roomRef.current;
    const actual = enabled && publishVideo;
    if (room?.state === "connected") await room.localParticipant.setCameraEnabled(actual);
    setMedia((m) => ({ ...m, cameraEnabled: actual }));
  }, [publishVideo]);

  useEffect(() => {
    if (!roomInfo?.url || !roomInfo?.token) {
      setMedia((m) => ({
        ...m,
        status: "idle",
        microphoneEnabled: false,
        cameraEnabled: false,
        canToggleMicrophone: false,
        canToggleCamera: false,
        hasRemoteVideo: false,
        remoteVideoTrack: null,
        localVideoTrack: null,
      }));
      return;
    }
    const env = ensureLiveKit();
    if (!env) {
      // Native module not in this build (Expo Go / web bundle) — avatar-only fallback.
      setMedia((m) => ({
        ...m,
        status: "unavailable",
        microphoneEnabled: false,
        cameraEnabled: false,
        canToggleMicrophone: false,
        canToggleCamera: false,
        hasRemoteVideo: false,
        remoteVideoTrack: null,
        localVideoTrack: null,
      }));
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
      setMedia((m) => ({
        ...m,
        status: "connected",
        canToggleMicrophone: !modRef.current || disguiseReadyRef.current,
        canToggleCamera: publishVideo,
        hasRemoteVideo: !!remote,
        remoteVideoTrack: remote,
        localVideoTrack: local,
      }));
    };

    (async () => {
      setMedia((m) => ({ ...m, status: "connecting" }));
      await lk.AudioSession.startAudioSession();
      await room.connect(reachableLiveKitUrl(roomInfo.url), roomInfo.token);
      if (cancelled) return void room.disconnect();
      disguiseReadyRef.current = modRef.current
        ? await setNativeVoiceDisguiseEnabled(true)
        : await setNativeVoiceDisguiseEnabled(false);
      const micOn = userMicRef.current && (!modRef.current || disguiseReadyRef.current);
      const cameraOn = userCameraRef.current && publishVideo;
      await room.localParticipant.setMicrophoneEnabled(micOn);
      await room.localParticipant.setCameraEnabled(cameraOn);
      const E = client.RoomEvent;
      room
        .on(E.TrackSubscribed, sync)
        .on(E.TrackUnsubscribed, sync)
        .on(E.LocalTrackPublished, sync)
        .on(E.LocalTrackUnpublished, sync)
        .on(E.ParticipantConnected, sync)
        .on(E.ParticipantDisconnected, sync);
      sync();
      setMedia((m) => ({ ...m, microphoneEnabled: micOn, cameraEnabled: cameraOn }));
    })().catch((e) => {
      console.warn("[speed-date] native livekit connect failed:", e);
      if (!cancelled)
        setMedia((m) => ({
          ...m,
          status: "unavailable",
          microphoneEnabled: false,
          cameraEnabled: false,
          canToggleMicrophone: false,
          canToggleCamera: false,
          hasRemoteVideo: false,
          remoteVideoTrack: null,
          localVideoTrack: null,
        }));
    });

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      disguiseReadyRef.current = false;
      void setNativeVoiceDisguiseEnabled(false);
      void lk.AudioSession.stopAudioSession();
    };
    // Reconnect only when the ROOM changes; publishVideo/modulateVoice apply live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomInfo?.room]);

  // Camera follows the stage's publish permission (server-enforced via token grant).
  useEffect(() => {
    const room = roomRef.current;
    const actual = publishVideo && userCameraRef.current;
    if (room && room.state === "connected") void room.localParticipant.setCameraEnabled(actual);
    setMedia((m) => ({
      ...m,
      cameraEnabled: room?.state === "connected" ? actual : false,
      canToggleCamera: room?.state === "connected" && publishVideo,
    }));
  }, [publishVideo]);

  // Stage transitions mute first, then install/remove DSP, then republish only on success.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    let alive = true;
    void (async () => {
      await room.localParticipant.setMicrophoneEnabled(false);
      const ready = await setNativeVoiceDisguiseEnabled(modulateVoice);
      if (!alive) return;
      disguiseReadyRef.current = modulateVoice ? ready : false;
      const micOn = userMicRef.current && (!modulateVoice || ready);
      await room.localParticipant.setMicrophoneEnabled(micOn);
      if (!alive) return;
      setMedia((m) => ({
        ...m,
        microphoneEnabled: micOn,
        canToggleMicrophone: !modulateVoice || ready,
      }));
    })();
    return () => {
      alive = false;
    };
  }, [modulateVoice]);

  return { ...media, setMicrophoneEnabled, setCameraEnabled };
}
