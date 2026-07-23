/**
 * Native placeholder. Real native video arrives with `@livekit/react-native` (VideoTrack) in an
 * EAS dev build; until then the avatar-only fallback renders, so this component draws nothing.
 */
export function VideoView(_props: { track: unknown; mirror?: boolean }) {
  return null;
}
