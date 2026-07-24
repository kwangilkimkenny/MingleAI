import { StyleSheet } from "react-native";

/**
 * Native video renderer. Uses `@livekit/react-native`'s VideoView (guarded require — in builds
 * without the native module, e.g. Expo Go, this renders nothing and the avatar fallback shows).
 * `track` is a livekit-client VideoTrack object supplied by the native media seam.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
function nativeLib(): any | null {
  try {
    return require("@livekit/react-native");
  } catch {
    return null;
  }
}

export function VideoView({ track, mirror }: { track: unknown; mirror?: boolean }) {
  const lk = nativeLib();
  if (!lk?.VideoView || !track) return null;
  const LKVideoView = lk.VideoView;
  return (
    <LKVideoView
      videoTrack={track as any}
      style={StyleSheet.absoluteFill}
      objectFit="cover"
      mirror={mirror}
    />
  );
}
