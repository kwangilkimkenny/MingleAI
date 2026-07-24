import { type ReactNode, useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { fonts, masterpiece } from "../lib/theme";

const MAN = require("../../assets/images/renaissance-man-cutout.png");
const WOMAN = require("../../assets/images/renaissance-woman-cutout.png");

/**
 * Masterpiece hero — the fine-art editorial brand surface (entrance / home hero / onboarding).
 * Cream paper + halftone dots, a classical cutout figure bleeding off the right edge that morphs
 * ambiently between the two Renaissance figures (crossfade + a slow breathing scale — a lightweight
 * stand-in for a true Skia warp), a Myeongjo serif headline, and content (usually a black pill CTA)
 * on the left. Reduced-motion shows a single static figure. Line-art tokens are NOT used here.
 */
export function MasterpieceHero({
  eyebrow,
  headline,
  subhead,
  figure = "both",
  tone = "cream",
  height = 380,
  rounded = false,
  children,
  style,
}: {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  /** "both" cross-morphs man↔woman; or pin a single figure. */
  figure?: "both" | "man" | "woman";
  tone?: "cream" | "creamDeep";
  height?: number;
  /** Round the bottom corners (home hero card); entrance is full-bleed. */
  rounded?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (figure !== "both" || reduced) return;
    t.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [figure, reduced, t]);

  const manStyle = useAnimatedStyle(() => ({
    opacity: figure === "man" ? 1 : figure === "woman" ? 0 : interpolate(t.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1.0, 1.03]) }],
  }));
  const womanStyle = useAnimatedStyle(() => ({
    opacity: figure === "woman" ? 1 : figure === "man" ? 0 : interpolate(t.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1.03, 1.0]) }],
  }));

  const bg = tone === "creamDeep" ? masterpiece.creamDeep : masterpiece.cream;
  const figH = height + 48;

  return (
    <View
      style={[
        styles.root,
        { height, backgroundColor: bg },
        rounded && styles.rounded,
        style,
      ]}
    >
      {/* halftone dot field */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="mp-dots" width={9} height={9} patternUnits="userSpaceOnUse">
            <Circle cx={1.4} cy={1.4} r={1.15} fill={masterpiece.dot} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#mp-dots)" opacity={0.5} />
      </Svg>

      {/* classical figure(s) — bleed off the right edge */}
      <View style={[styles.figWrap, { height: figH }]} pointerEvents="none">
        <Animated.Image source={MAN} resizeMode="contain" style={[styles.fig, manStyle]} />
        <Animated.Image source={WOMAN} resizeMode="contain" style={[styles.fig, womanStyle]} />
      </View>

      {/* copy + actions on the left */}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headline}>{headline}</Text>
        {subhead ? <Text style={styles.subhead}>{subhead}</Text> : null}
        {children ? <View style={styles.actions}>{children}</View> : null}
      </View>
    </View>
  );
}

/** Black pill CTA — the masterpiece primary action. */
export function PillButton({
  title,
  onPress,
  variant = "solid",
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "solid" | "ghost";
  style?: StyleProp<ViewStyle>;
}) {
  const solid = variant === "solid";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        solid ? styles.pillSolid : styles.pillGhost,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[styles.pillText, { color: solid ? masterpiece.onPill : masterpiece.inkDeep }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", overflow: "hidden", justifyContent: "flex-end" },
  rounded: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  figWrap: { position: "absolute", right: -44, top: -8, width: "72%" },
  fig: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  copy: { padding: 22, paddingBottom: 24, maxWidth: "70%" },
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: masterpiece.tag,
    marginBottom: 10,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: masterpiece.inkDeep,
  },
  subhead: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: masterpiece.inkSoft,
    marginTop: 12,
    maxWidth: 220,
  },
  actions: { marginTop: 18, gap: 10, alignSelf: "flex-start", minWidth: 200 },
  pill: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  pillSolid: { backgroundColor: masterpiece.pill },
  pillGhost: { backgroundColor: "transparent", borderWidth: 1.3, borderColor: masterpiece.pillGhostBorder },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 14 },
});
