import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { SpeedDateRoomInfo } from "@mingle/client-core";
import type { SpeedDateMedia } from "./speed-date-media";

/**
 * Web LiveKit media (real WebRTC). Connects to the room-scoped LiveKit session from the snapshot,
 * publishes the microphone always and the camera only when the stage allows it (`publishVideo` =
 * FACE), and exposes the remote partner's video track + the local self-view track (both as raw
 * MediaStreamTracks the VideoView renders into a <video> element).
 */
export function useSpeedDateMedia(
  roomInfo: SpeedDateRoomInfo | null,
  publishVideo: boolean,
): SpeedDateMedia {
  const [media, setMedia] = useState<SpeedDateMedia>({
    status: "idle",
    hasRemoteVideo: false,
    remoteVideoTrack: null,
    localVideoTrack: null,
  });
  const roomRef = useRef<Room | null>(null);

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
      await room.localParticipant.setMicrophoneEnabled(true);
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
      room.disconnect();
      roomRef.current = null;
    };
    // Reconnect only when the ROOM changes; publishVideo changes are applied without reconnect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomInfo?.room]);

  // Toggle camera when the stage's publish permission changes (without tearing down the room).
  useEffect(() => {
    const room = roomRef.current;
    if (room && room.state === "connected") void room.localParticipant.setCameraEnabled(publishVideo);
  }, [publishVideo]);

  return media;
}
