/**
 * SVG doodle primitives — the wireframe's hand-drawn language, RN-native.
 * Borders are pre-computed jittered paths (doodle-path.ts), NOT feTurbulence
 * (unsupported in react-native-svg on native). Seeds are stable per element so
 * nothing re-wobbles on re-render.
 */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { hatchSegments, wobbleRect, type WonkyRadius } from "../lib/doodle-path";
import { colors, doodle, fonts } from "../lib/theme";

const PAD = 12; // svg overdraw margin so the shadow/jitter never clips

export function WobbleBox({
  children,
  radius,
  seed = 1,
  bg = colors.paper,
  stroke = colors.ink,
  strokeWidth = 2.2,
  shadow = false,
  rotate,
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
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const d = size ? wobbleRect(size.w, size.h, radius, seed) : null;
  return (
    <View
      style={[styles.wobbleOuter, rotate ? { transform: [{ rotate }] } : null, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size && d ? (
        <Svg
          style={{
            position: "absolute",
            left: -PAD,
            top: -PAD,
            pointerEvents: "none",
            zIndex: 0,
          }}
          width={size.w + PAD * 2}
          height={size.h + PAD * 2}
          viewBox={`${-PAD} ${-PAD} ${size.w + PAD * 2} ${size.h + PAD * 2}`}
        >
          {shadow ? (
            <Path
              d={d}
              fill={colors.ink}
              transform={`translate(${doodle.shadow.x}, ${doodle.shadow.y})`}
            />
          ) : null}
          <Path d={d} fill={bg} stroke={stroke} strokeWidth={strokeWidth} />
        </Svg>
      ) : null}
      <View style={[styles.wobbleContent, contentStyle]}>{children}</View>
    </View>
  );
}

export function MatchGauge({
  label,
  value,
  seed = 9,
}: {
  label: string;
  value: number;
  seed?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const [w, setW] = useState(0);
  const H = 16;
  const trackD = w > 0 ? wobbleRect(w, H, doodle.radius.chip, seed, { amp: 1.1, step: 12 }) : null;
  const fillW = (w * pct) / 100;
  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeLab}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Text style={styles.gaugeValue}>{Math.round(pct)}</Text>
      </View>
      <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {trackD ? (
          <Svg
            width={w + PAD}
            height={H + PAD}
            viewBox={`${-PAD / 2} ${-PAD / 2} ${w + PAD} ${H + PAD}`}
            style={{ position: "absolute", left: -PAD / 2, top: -PAD / 2 }}
          >
            <Path d={trackD} fill={colors.paper} stroke={colors.ink} strokeWidth={1.9} />
            {hatchSegments(fillW, H).map((s, i) => (
              <Line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={colors.ink}
                strokeWidth={2.2}
              />
            ))}
            {fillW > 2 ? (
              <Line x1={fillW} y1={0} x2={fillW} y2={H} stroke={colors.ink} strokeWidth={2} />
            ) : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

export function DoodleFace({
  size = 44,
  variant = "smile",
  inverted = false,
  seed = 3,
}: {
  size?: number;
  variant?: "smile" | "flat" | "open";
  inverted?: boolean;
  seed?: number;
}) {
  const R = 32;
  const face = inverted ? colors.ink : colors.paper;
  const feat = inverted ? colors.paper : colors.ink;
  // Hand-drawn circle: wobbleRect with fully-round radii reads as a drawn circle.
  const circleD = wobbleRect(
    R * 2,
    R * 2,
    {
      borderTopLeftRadius: R,
      borderTopRightRadius: R,
      borderBottomRightRadius: R,
      borderBottomLeftRadius: R,
    },
    seed,
    { amp: 1.2, step: 9 },
  );
  const mouth =
    variant === "flat"
      ? `M${R - 9} ${R + 9} h18`
      : variant === "open"
        ? `M${R - 7} ${R + 7} a7 6 0 0 0 14 0 Z`
        : `M${R - 10} ${R + 7} C${R - 5} ${R + 14} ${R + 5} ${R + 14} ${R + 10} ${R + 7}`;
  return (
    <Svg width={size} height={size} viewBox={`-3 -3 ${R * 2 + 6} ${R * 2 + 6}`}>
      <Path d={circleD} fill={face} stroke={colors.ink} strokeWidth={2.6} />
      <Circle cx={R - 9} cy={R - 5} r={2.8} fill={feat} />
      <Circle cx={R + 9} cy={R - 5} r={2.8} fill={feat} />
      <Path
        d={mouth}
        fill={variant === "open" ? feat : "none"}
        stroke={feat}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
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
}: {
  label: string;
  on?: boolean;
  tiny?: boolean;
  onPress?: () => void;
}) {
  const chip = (
    <WobbleBox
      radius={doodle.radius.chip}
      seed={label.length + (on ? 40 : 0)}
      bg={on ? colors.ink : colors.paper}
      strokeWidth={1.8}
      contentStyle={[tiny ? styles.chipTiny : styles.chipInner, onPress && styles.chipTouchable]}
    >
      <Text
        style={[
          tiny ? styles.chipTextTiny : styles.chipText,
          { color: on ? colors.paper : colors.ink },
        ]}
      >
        {label}
      </Text>
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
