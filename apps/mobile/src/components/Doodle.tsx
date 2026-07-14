/**
 * Doodle B&W primitives (pure black & white, zero chroma, no new deps).
 *
 * The signature "hand-drawn sticker" look comes from WobbleBox (DoodleSvg.tsx): a
 * pre-computed jittered SVG border (+ optional hard offset ink shadow, no blur — RN's
 * native shadow/elevation always blurs). Combined with wonky per-corner radii and a
 * slight rotation, plain B&W reads as a doodle.
 */
import type { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { WobbleBox } from "./DoodleSvg";
import { colors, doodle, fonts } from "../lib/theme";

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
  bg = colors.paper,
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
    <WobbleBox
      radius={radius}
      seed={seed}
      bg={bg}
      shadow
      rotate={rotate}
      style={[styles.shadowOuter, style]}
    >
      {children}
    </WobbleBox>
  );
}

export function DoodleButton({
  title,
  onPress,
  variant = "secondary",
  disabled = false,
  rotate,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  rotate?: string;
  /** Optional leading icon (e.g. a Lucide line icon), tinted to match the label. */
  icon?: (color: string, size: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  // Flat button — ink outline only, NO offset shadow. Primary = the accent (dark pink) block.
  const bg = disabled ? colors.fillDeep : primary ? colors.accent : colors.paper;
  const fg = disabled ? colors.grayMid : primary ? colors.onAccent : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      <WobbleBox
        radius={doodle.radius.button}
        bg={bg}
        stroke={colors.ink}
        rotate={rotate}
        style={styles.flatButton}
        contentStyle={styles.btnInner}
      >
        {icon ? icon(fg, 20) : null}
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      </WobbleBox>
    </Pressable>
  );
}

export function DoodleCard({
  children,
  tone = "paper",
  rotate,
  style,
  contentStyle,
}: {
  children: ReactNode;
  tone?: "paper" | "fill";
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const bg = tone === "fill" ? colors.fill : colors.paper;
  return (
    <ShadowBox radius={doodle.radius.card} bg={bg} rotate={rotate} style={style}>
      <View style={[styles.cardInner, contentStyle]}>{children}</View>
    </ShadowBox>
  );
}

/** Doodle text input container styles (spread onto a TextInput's style). */
export const doodleInputStyle: TextStyle = {
  borderWidth: doodle.border,
  borderColor: colors.ink,
  backgroundColor: colors.paper,
  color: colors.ink,
  paddingVertical: 12,
  paddingHorizontal: 14,
  fontSize: 15,
  ...doodle.radius.input,
};

const styles = StyleSheet.create({
  shadowOuter: { position: "relative", alignSelf: "stretch" },
  pressable: { alignSelf: "stretch" },
  flatButton: { alignSelf: "stretch" },
  btnInner: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 0.3 },
  cardInner: { padding: 16 },
});
