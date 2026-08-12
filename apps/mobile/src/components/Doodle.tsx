/**
 * Line-art primitives: white surfaces with thin dark-brown outlines and one blush-pink point color.
 *
 * Elevation is outline-first. Cards read via a thin hairline, not a shadow. Primary buttons fill
 * with accentStrong + white label (AA-safe; the bright accent is for strokes/icons only).
 * Secondary buttons are white + thin outline.
 */
import type { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { WobbleBox } from "./DoodleSvg";
import { colors, control, dark, doodle, fonts } from "../lib/theme";

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
  style,
  contentStyle,
}: {
  children: ReactNode;
  tone?: "paper" | "fill" | "dark";
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const bg = tone === "dark" ? dark.surface : tone === "fill" ? colors.fill : colors.card;
  const cardStroke =
    tone === "dark" ? dark.border : tone === "fill" ? colors.fillDeep : colors.border;
  return (
    <WobbleBox radius={doodle.radius.card} bg={bg} stroke={cardStroke} style={style}>
      <View style={[styles.cardInner, contentStyle]}>{children}</View>
    </WobbleBox>
  );
}

const styles = StyleSheet.create({
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
