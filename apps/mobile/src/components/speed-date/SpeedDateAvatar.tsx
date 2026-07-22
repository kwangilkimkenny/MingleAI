import { View, StyleSheet } from "react-native";
import { DoodleFace } from "../DoodleSvg";
import { colors } from "../../lib/theme";

/** Static per-session avatar tint, keyed by the server-assigned avatarId. */
const AVATAR_BG: Record<string, string> = {
  "av-coral": colors.accentFill,
  "av-mint": "#BFE3D0",
  "av-plum": "#D9C7E0",
  "av-amber": "#F3D9A6",
  "av-sky": "#BFD6EA",
  "av-moss": "#C7D6B0",
  "av-rose": "#F3C4CE",
  "av-slate": "#CBD0D6",
};

function seedFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 7) + 1;
}

/**
 * The blind-stage character image: a static, session-scoped avatar unrelated to the real
 * profile photo. Shown whenever live camera video is not being published (DISGUISED / VOICE
 * stages, or FACE before the remote camera track arrives).
 */
export function SpeedDateAvatar({ avatarId, size = 96 }: { avatarId: string; size?: number }) {
  const bg = AVATAR_BG[avatarId] ?? colors.fillDeep;
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <DoodleFace size={Math.round(size * 0.62)} variant="open" seed={seedFor(avatarId)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink,
  },
});
