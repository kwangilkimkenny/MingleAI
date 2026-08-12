/**
 * Rounded line-art surfaces and chips shared by the native and web clients.
 */
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, dark, doodle, fonts } from "../lib/theme";

type RoundedRadius = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/**
 * Rounded soft surface — the base for every button/card/chip/input. Post-redesign this is a plain
 * View with a soft rose hairline + rounded corners, NOT the old
 * jittered SVG path. (Bonus: no onLayout measure pass, so surfaces paint filled on the first frame
 * instead of flashing empty.) The look is intentionally clean and un-wobbled now.
 */
export function WobbleBox({
  children,
  radius,
  bg = colors.card,
  stroke = colors.border,
  strokeWidth = doodle.border,
  style,
  contentStyle,
}: {
  children?: ReactNode;
  radius: RoundedRadius;
  bg?: string;
  stroke?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { backgroundColor: bg, borderWidth: strokeWidth, borderColor: stroke, ...radius },
        style,
      ]}
    >
      <View style={[styles.wobbleContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function DoodleChip({
  label,
  on = false,
  tiny = false,
  onPress,
  dark: isDark = false,
}: {
  label: string;
  on?: boolean;
  tiny?: boolean;
  onPress?: () => void;
  /** 홈 테마 다크 화면용 칩. */
  dark?: boolean;
}) {
  const chipBg = isDark
    ? on
      ? dark.pill
      : "transparent"
    : on
      ? colors.accentStrong
      : colors.card;
  // 비활성 칩은 테두리로만 식별된다 — 다크에서는 비텍스트 3:1을 만족하는 borderStrong.
  const chipStroke = isDark ? (on ? dark.pill : dark.borderStrong) : on ? colors.accentStrong : colors.border;
  const chipText = isDark ? (on ? dark.onPill : dark.textMuted) : on ? colors.onAccent : colors.ink;
  const chip = (
    <WobbleBox
      radius={doodle.radius.chip}
      bg={chipBg}
      stroke={chipStroke}
      strokeWidth={1.5}
      contentStyle={[tiny ? styles.chipTiny : styles.chipInner, onPress && styles.chipTouchable]}
    >
      <Text style={[tiny ? styles.chipTextTiny : styles.chipText, { color: chipText }]}>{label}</Text>
    </WobbleBox>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={tiny ? 8 : 4}
    >
      {chip}
    </Pressable>
  ) : (
    chip
  );
}

const styles = StyleSheet.create({
  wobbleContent: { position: "relative", zIndex: 1 },
  chipInner: { paddingVertical: 5, paddingHorizontal: 13 },
  chipTiny: { paddingVertical: 2, paddingHorizontal: 9 },
  chipTouchable: { minHeight: 44, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  chipTextTiny: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
