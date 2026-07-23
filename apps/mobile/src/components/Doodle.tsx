/**
 * Doodle primitives: warm ink-and-paper surfaces with restrained semantic coral.
 *
 * The signature "hand-drawn sticker" look comes from WobbleBox (DoodleSvg.tsx): a
 * pre-computed jittered SVG border (+ optional hard offset ink shadow, no blur — RN's
 * native shadow/elevation always blurs). Combined with wonky per-corner radii and a
 * slight rotation, the surface reads as a hand-drawn object without sacrificing legibility.
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
import { colors, control, doodle, fonts } from "../lib/theme";

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
}) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  const dangerSolid = variant === "dangerSolid";
  const off = disabled || busy;
  // Soft rounded button. Primary = rose fill; secondary = white + soft rose hairline.
  const bg = off
    ? colors.fill
    : dangerSolid
      ? colors.danger
      : primary
        ? colors.accent
        : colors.card;
  const fg = off
    ? colors.grayMid
    : danger
      ? colors.danger
      : primary || dangerSolid
        ? colors.onAccent
        : colors.ink;
  const stroke = danger || dangerSolid ? colors.danger : primary ? colors.accent : colors.border;
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
  tone?: "paper" | "fill";
  /** Reserve the hard sticker shadow for interactive or hero surfaces. */
  elevated?: boolean;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const bg = tone === "fill" ? colors.fill : colors.card;
  if (!elevated) {
    return (
      <WobbleBox
        radius={doodle.radius.card}
        bg={bg}
        stroke={tone === "fill" ? colors.fillDeep : colors.border}
        rotate={rotate}
        style={style}
      >
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
  btnText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: 0.3 },
  seriousBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  cardInner: { padding: 16 },
});
