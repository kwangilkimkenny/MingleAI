/**
 * Line-art primitives: white surfaces with thin dark-brown outlines and one blush-pink point color.
 *
 * Elevation is outline-first — cards read via a thin hairline (WobbleBox in DoodleSvg.tsx, now a
 * plain rounded View), not a shadow. Primary buttons fill with accentStrong + white label (AA-safe;
 * the bright accent is for strokes/icons only). Secondary buttons are white + thin outline.
 */
import type { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { WobbleBox } from "./DoodleSvg";
import { colors, control, dark, doodle, fonts } from "../lib/theme";

type WonkyRadius = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/**
 * Wraps content in a hand-drawn wobble border + hard offset ink shadow (via WobbleBox).
 */
export function ShadowBox({
  children,
  radius,
  bg = colors.card,
  rotate,
  style,
  seed = 2,
}: {
  children: ReactNode;
  radius: WonkyRadius;
  bg?: string;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  seed?: number;
}) {
  return (
    <WobbleBox radius={radius} seed={seed} bg={bg} shadow rotate={rotate} style={[styles.shadowOuter, style]}>
      {children}
    </WobbleBox>
  );
}

export function DoodleButton({
  title,
  onPress,
  variant = "secondary",
  disabled = false,
  busy = false,
  icon,
  style,
  serious = false,
  tone = "light",
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "dangerSolid";
  disabled?: boolean;
  /** Show a spinner and block presses while an async action runs. */
  busy?: boolean;
  rotate?: string;
  /** Optional leading icon (e.g. a Lucide line icon), tinted to match the label. */
  icon?: (color: string, size: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use the UI sans for consent, safety, and irreversible decisions. */
  serious?: boolean;
  /** "dark" = 홈 테마 화면 — primary = cream pill, secondary = dark surface + light outline. */
  tone?: "light" | "dark";
}) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  const dangerSolid = variant === "dangerSolid";
  const off = disabled || busy;
  const isDark = tone === "dark";
  // Line-art (light) button: primary = accentStrong fill + white label. Dark (홈 테마) button:
  // primary = cream pill + dark label; secondary = dark surface + light outline.
  const bg = off
    ? isDark
      ? dark.surfaceHi
      : colors.fill
    : dangerSolid
      ? danger || dangerSolid
        ? isDark
          ? dark.danger
          : colors.danger
        : colors.danger
      : primary
        ? isDark
          ? dark.pill
          : colors.accentStrong
        : isDark
          ? "transparent"
          : colors.card;
  const fg = off
    ? isDark
      ? dark.textMuted
      : colors.grayMid
    : danger
      ? isDark
        ? dark.danger
        : colors.danger
      : dangerSolid
        ? isDark
          ? dark.onDanger
          : colors.onAccent
        : primary
          ? isDark
            ? dark.onPill
            : colors.onAccent
          : isDark
            ? dark.text
            : colors.ink;
  const stroke =
    danger || dangerSolid
      ? isDark
        ? dark.danger
        : colors.danger
      : primary
        ? isDark
          ? dark.pill
          : colors.accentStrong
        : isDark
          ? dark.border
          : colors.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: off, busy }}
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.pressable,
        off ? { opacity: 0.55 } : pressed ? { opacity: 0.9 } : null,
        style,
      ]}
    >
      <WobbleBox
        radius={doodle.radius.button}
        bg={bg}
        stroke={stroke}
        style={styles.flatButton}
        contentStyle={styles.btnInner}
      >
        {busy ? (
          <ActivityIndicator color={fg} size="small" />
        ) : icon ? (
          icon(fg, 20)
        ) : null}
        <Text style={[styles.btnText, (serious || danger || dangerSolid) && styles.seriousBtnText, { color: fg }]}>{title}</Text>
      </WobbleBox>
    </Pressable>
  );
}

export function DoodleCard({
  children,
  tone = "paper",
  elevated = false,
  rotate,
  style,
  contentStyle,
}: {
  children: ReactNode;
  tone?: "paper" | "fill" | "dark";
  /** Reserve the hard sticker shadow for interactive or hero surfaces. */
  elevated?: boolean;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const bg = tone === "dark" ? dark.surface : tone === "fill" ? colors.fill : colors.card;
  const cardStroke =
    tone === "dark" ? dark.border : tone === "fill" ? colors.fillDeep : colors.border;
  if (!elevated) {
    return (
      <WobbleBox radius={doodle.radius.card} bg={bg} stroke={cardStroke} rotate={rotate} style={style}>
        <View style={[styles.cardInner, contentStyle]}>{children}</View>
      </WobbleBox>
    );
  }
  return (
    <ShadowBox radius={doodle.radius.card} bg={bg} rotate={rotate} style={style}>
      <View style={[styles.cardInner, contentStyle]}>{children}</View>
    </ShadowBox>
  );
}

/** Doodle text input container styles (spread onto a TextInput's style). */
export const doodleInputStyle: TextStyle = {
  borderWidth: doodle.border,
  borderColor: colors.border,
  backgroundColor: colors.card,
  color: colors.ink,
  paddingVertical: 12,
  paddingHorizontal: 14,
  fontFamily: fonts.body,
  fontSize: 16,
  lineHeight: 24,
  ...doodle.radius.input,
};

const styles = StyleSheet.create({
  shadowOuter: { position: "relative", alignSelf: "stretch" },
  pressable: { alignSelf: "stretch" },
  flatButton: { alignSelf: "stretch" },
  btnInner: {
    flexDirection: "row",
    gap: 8,
    minHeight: control.buttonHeight,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 21, letterSpacing: 0 },
  seriousBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  cardInner: { padding: 16 },
});
