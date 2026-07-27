import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../lib/theme";

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

/**
 * The blind-stage character image: a static, session-scoped avatar unrelated to the real
 * profile photo. Shown whenever live camera video is not being published (DISGUISED / VOICE
 * stages, or FACE before the remote camera track arrives).
 * 두들 얼굴 폐기(2026-07-27 지시) — 파스텔 원 + 별명 이니셜만.
 */
export function SpeedDateAvatar({
  avatarId,
  nickname,
  size = 96,
}: {
  avatarId: string;
  /** 세션 별명 — 첫 글자가 이니셜로 표시된다. */
  nickname?: string;
  size?: number;
}) {
  const bg = AVATAR_BG[avatarId] ?? colors.fillDeep;
  const initial = nickname?.trim().charAt(0) ?? "";
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      {initial ? (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.34) }]}>{initial}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  initial: { fontFamily: fonts.bodySemibold, color: colors.ink },
});
