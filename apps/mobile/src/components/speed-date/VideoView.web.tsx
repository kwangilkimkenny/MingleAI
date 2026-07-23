import { useEffect, useRef } from "react";

/** Renders a MediaStreamTrack into a DOM <video> (web only). `mirror` flips the self-view. */
export function VideoView({ track, mirror }: { track: unknown; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mst = track as MediaStreamTrack | null;
    if (mst) {
      el.srcObject = new MediaStream([mst]);
      el.play?.().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        backgroundColor: "#000",
        transform: mirror ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
