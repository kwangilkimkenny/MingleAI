/**
 * Doodle B&W primitives (pure black & white, zero chroma, no new deps).
 *
 * The signature "hand-drawn sticker" look is a SOLID offset shadow with no blur: an ink
 * layer is painted behind the surface and translated by (doodle.shadow.x, y). RN's native
 * shadow/elevation always blurs, so we fake the hard edge with a translated sibling View.
 * Combined with wonky per-corner radii and a slight rotation, plain B&W reads as a doodle.
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
import { colors, doodle } from "../lib/theme";

type WonkyRadius = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/**
 * Wraps content in a hard offset ink shadow + ink border. The outer View sizes to the
 * in-flow content child; the absolutely-positioned shadow child fills that size and is
 * translated, so the shadow always matches the surface with no blur.
 */
export function ShadowBox({
  children,
  radius,
  bg = colors.paper,
  rotate,
  style,
}: {
  children: ReactNode;
  radius: WonkyRadius;
  bg?: string;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.shadowOuter, rotate ? { transform: [{ rotate }] } : null, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          radius,
          {
            backgroundColor: colors.ink,
            transform: [{ translateX: doodle.shadow.x }, { translateY: doodle.shadow.y }],
          },
        ]}
      />
      <View style={[radius, styles.surface, { backgroundColor: bg }]}>{children}</View>
    </View>
  );
}

export function DoodleButton({
  title,
  onPress,
  variant = "secondary",
  disabled = false,
  rotate,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  const bg = disabled ? colors.fillDeep : primary ? colors.ink : colors.paper;
  const fg = disabled ? colors.grayMid : primary ? colors.paper : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        // Press "into" the shadow: nudge toward the offset so it reads as pressed.
        pressed && !disabled
          ? { transform: [{ translateX: doodle.shadow.x / 2 }, { translateY: doodle.shadow.y / 2 }] }
          : null,
        style,
      ]}
    >
      <ShadowBox radius={doodle.radius.button} bg={bg} rotate={rotate}>
        <View style={styles.btnInner}>
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      </ShadowBox>
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
  surface: { borderWidth: doodle.border, borderColor: colors.ink },
  pressable: { alignSelf: "stretch" },
  btnInner: { paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  cardInner: { padding: 16 },
});
