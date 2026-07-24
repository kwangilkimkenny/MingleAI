import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { SpeedDateRoomInfo } from "@mingle/client-core";
import type { SpeedDateMedia } from "./speed-date-media";

/**
 * Web LiveKit media (real WebRTC). Connects to the room-scoped LiveKit session from the snapshot,
 * publishes the microphone always and the camera only when the stage allows it (`publishVideo` =
 * FACE), and exposes the remote partner's video + local self-view tracks.
 *
 * Voice disguise (DISGUISED stage): the outgoing mic is routed through a Web Audio pitch-shift
 * AudioWorklet BEFORE publishing, so the raw voice never leaves this device (publisher-side =
 * privacy-preserving; a listener can't recover the original). The graph is always connected; only
 * the `pitchRatio` param changes — 1.0 = passthrough (VOICE/FACE), shifted for DISGUISED — so stage
 * changes never republish the track. Falls back to the plain mic if the audio graph can't be built.
 */
const DISGUISED_PITCH_RATIO = 0.72; // lower the voice to disguise identity

/** Inline granular pitch-shifter worklet (overlap-add, two triangular-crossfaded read taps). */
const PITCH_WORKLET_SRC = `
class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "pitchRatio", defaultValue: 1, minValue: 0.5, maxValue: 2, automationRate: "k-rate" }];
  }
  constructor() {
    super();
    this.size = 8192;
    this.buffer = new Float32Array(this.size);
    this.wp = 0;      // write pointer
    this.rp = 0;      // fractional read pointer
    this.grain = this.size / 2;
  }
  sample(idx) {
    const i0 = Math.floor(idx) % this.size;
    const i1 = (i0 + 1) % this.size;
    const f = idx - Math.floor(idx);
    return this.buffer[i0] * (1 - f) + this.buffer[i1] * f;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0][0];
    const out = outputs[0][0];
    if (!out) return true;
    const ratio = params.pitchRatio[0];
    if (!inp) { out.fill(0); return true; }
    for (let i = 0; i < inp.length; i++) {
      this.buffer[this.wp] = inp[i];
      if (ratio === 1) {
        out[i] = inp[i];
      } else {
        const s1 = this.sample(this.rp);
        const s2 = this.sample((this.rp + this.grain) % this.size);
        const pos = (this.rp % this.grain) / this.grain; // triangular crossfade 0..1
        out[i] = s1 * pos + s2 * (1 - pos);
        this.rp += ratio;
        if (this.rp >= this.size) this.rp -= this.size;
      }
      this.wp = (this.wp + 1) % this.size;
    }
    return true;
  }
}
registerProcessor("pitch-shift", PitchShiftProcessor);
`;

type AudioChain = {
  ctx: AudioContext;
  node: AudioWorkletNode;
  raw: MediaStream;
};

/** Build the pitch-shift audio graph from a fresh mic capture; returns the processed track + chain. */
async function buildPitchedMic(): Promise<{ track: MediaStreamTrack; chain: AudioChain }> {
  const raw = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  const url = URL.createObjectURL(new Blob([PITCH_WORKLET_SRC], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const src = ctx.createMediaStreamSource(raw);
  const node = new AudioWorkletNode(ctx, "pitch-shift");
  const dest = ctx.createMediaStreamDestination();
  src.connect(node).connect(dest);
  return { track: dest.stream.getAudioTracks()[0], chain: { ctx, node, raw } };
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
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<AudioChain | null>(null);
  // Latest modulateVoice, so the async connect applies the right initial pitch without a re-run.
  const modRef = useRef(modulateVoice);
  modRef.current = modulateVoice;

  useEffect(() => {
    if (!roomInfo?.url || !roomInfo?.token) {
      setMedia({ status: "idle", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null });
      return;
    }
    const room = new Room();
    roomRef.current = room;
    let cancelled = false;

    const sync = () => {
      let remote: MediaStreamTrack | null = null;
      room.remoteParticipants.forEach((p) => {
        const pub = p.getTrackPublication(Track.Source.Camera);
        if (pub?.videoTrack?.mediaStreamTrack) remote = pub.videoTrack.mediaStreamTrack;
      });
      const localPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const local = localPub?.videoTrack?.mediaStreamTrack ?? null;
      setMedia({ status: "connected", hasRemoteVideo: !!remote, remoteVideoTrack: remote, localVideoTrack: local });
    };

    (async () => {
      setMedia((m) => ({ ...m, status: "connecting" }));
      await room.connect(roomInfo.url, roomInfo.token);
      if (cancelled) return void room.disconnect();

      // Publish a pitch-shiftable mic; fall back to the plain mic if the audio graph can't be built.
      try {
        const { track, chain } = await buildPitchedMic();
        chain.node.parameters.get("pitchRatio")!.value = modRef.current ? DISGUISED_PITCH_RATIO : 1;
        audioRef.current = chain;
        await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
      } catch (e) {
        console.warn("[speed-date] pitch mic failed, using plain mic:", e);
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      if (cancelled) return void room.disconnect();

      await room.localParticipant.setCameraEnabled(publishVideo);
      room
        .on(RoomEvent.TrackSubscribed, sync)
        .on(RoomEvent.TrackUnsubscribed, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync);
      sync();
    })().catch((e) => {
      console.warn("[speed-date] livekit connect failed:", e);
      if (!cancelled)
        setMedia({ status: "unavailable", hasRemoteVideo: false, remoteVideoTrack: null, localVideoTrack: null });
    });

    return () => {
      cancelled = true;
      const chain = audioRef.current;
      if (chain) {
        chain.raw.getTracks().forEach((t) => t.stop());
        void chain.ctx.close();
        audioRef.current = null;
      }
      room.disconnect();
      roomRef.current = null;
    };
    // Reconnect only when the ROOM changes; publishVideo/modulateVoice apply live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomInfo?.room]);

  // Toggle camera when the stage's publish permission changes (no room teardown).
  useEffect(() => {
    const room = roomRef.current;
    if (room && room.state === "connected") void room.localParticipant.setCameraEnabled(publishVideo);
  }, [publishVideo]);

  // Retune the pitch shift when the stage's voiceMod changes (just a param — no republish).
  useEffect(() => {
    const chain = audioRef.current;
    const p = chain?.node.parameters.get("pitchRatio");
    if (p) p.value = modulateVoice ? DISGUISED_PITCH_RATIO : 1;
  }, [modulateVoice]);

  return media;
}
