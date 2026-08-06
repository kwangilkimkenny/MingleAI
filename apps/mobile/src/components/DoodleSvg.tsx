/**
 * SVG doodle primitives — the wireframe's hand-drawn language, RN-native.
 * Borders are pre-computed jittered paths (doodle-path.ts), NOT feTurbulence
 * (unsupported in react-native-svg on native). Seeds are stable per element so
 * nothing re-wobbles on re-render.
 */
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { type WonkyRadius } from "../lib/doodle-path";
import { colors, dark, doodle, fonts, shadow as elevation } from "../lib/theme";

const PAD = 12; // svg overdraw margin (used by the remaining SVG primitives)

/**
 * Rounded soft surface — the base for every button/card/chip/input. Post-redesign this is a plain
 * View with a soft rose hairline + rounded corners (+ optional blurred elevation), NOT the old
 * jittered SVG path. (Bonus: no onLayout measure pass, so surfaces paint filled on the first frame
 * instead of flashing empty.) `seed`/`rotate` are accepted for call-site compatibility but ignored —
 * the look is intentionally clean and un-wobbled now.
 */
export function WobbleBox({
  children,
  radius,
  bg = colors.card,
  stroke = colors.border,
  strokeWidth = doodle.border,
  shadow = false,
  style,
  contentStyle,
}: {
  children?: ReactNode;
  radius: WonkyRadius;
  seed?: number;
  bg?: string;
  stroke?: string;
  strokeWidth?: number;
  shadow?: boolean;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { backgroundColor: bg, borderWidth: strokeWidth, borderColor: stroke, ...radius },
        shadow ? elevation.card : null,
        style,
      ]}
    >
      <View style={[styles.wobbleContent, contentStyle]}>{children}</View>
    </View>
  );
}

/** Native-safe dashed hairline — single-side dashed borders are broken in RN (facebook/react-native#24224). */
export function DashedLine({
  color = colors.grayLight,
  thickness = 1.6,
}: {
  color?: string;
  thickness?: number;
}) {
  return (
    <Svg height={thickness + 1} width="100%">
      <Line
        x1="0"
        y1={thickness / 2}
        x2="100%"
        y2={thickness / 2}
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
    </Svg>
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
  const chipStroke = isDark ? (on ? dark.pill : dark.border) : on ? colors.accentStrong : colors.border;
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
  wobbleOuter: { position: "relative" },
  gauge: { marginVertical: 6 },
  gaugeLab: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  gaugeLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  gaugeValue: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.ink },
  chipInner: { paddingVertical: 5, paddingHorizontal: 13 },
  chipTiny: { paddingVertical: 2, paddingHorizontal: 9 },
  chipTouchable: { minHeight: 44, justifyContent: "center" },
  chipText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  chipTextTiny: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
