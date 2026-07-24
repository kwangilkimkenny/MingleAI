import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors, control, dark, layout, space, type } from "../lib/theme";

/**
 * 공용 리스트 행 — List 아키타입(채팅·프로포즈·알림·차단·설정·맛집)과 Hub 허브 카드 내부에서
 * 동일한 행 구조를 강제한다. leading(아바타/아이콘) · title · subtitle · trailing(배지/버튼/셰브런).
 * onPress 있으면 Pressable, 없으면 정적 View. trailing 미지정 + onPress면 셰브런 자동.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
  gutter = layout.screenGutter,
  tone = "default",
  dark: isDark = false,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Horizontal inset. Default = screen gutter (full-bleed lists); pass 0 inside a card. */
  gutter?: number;
  /** "danger" tints the title crimson (destructive rows — 계정 삭제 등). */
  tone?: "default" | "danger";
  /** 홈 테마 다크 화면용 행. */
  dark?: boolean;
}) {
  const titleColor =
    tone === "danger" ? (isDark ? dark.danger : colors.danger) : isDark ? dark.text : colors.ink;
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, isDark && { color: dark.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight color={isDark ? dark.textMuted : colors.grayMid} size={20} strokeWidth={1.75} />
        ) : null)}
    </>
  );
  const rowStyle = [styles.row, { paddingHorizontal: gutter }];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function RowSeparator({
  gutter = layout.screenGutter,
  dark: isDark = false,
}: {
  gutter?: number;
  dark?: boolean;
}) {
  return <View style={[styles.sep, isDark && { backgroundColor: dark.line }, { marginLeft: gutter }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 60,
    paddingVertical: space.x3,
  },
  pressed: { opacity: 0.65 },
  leading: { width: control.minTouch, alignItems: "center" },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.body, color: colors.ink },
  subtitle: { ...type.caption, color: colors.grayMid, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.line },
});
