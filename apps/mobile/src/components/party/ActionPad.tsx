/**
 * ActionPad — 어몽어스식 우하단 고정 버튼판. 큰 메인 "사용" 버튼(컨텍스트 라벨
 * 변신) + 작은 보조 버튼들. 항상 같은 자리(근육 기억). 쿨다운은 SVG 원호 링.
 */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { wobbleRect } from "../../lib/doodle-path";
import { colors, fonts } from "../../lib/theme";

export interface PadAction {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
  cooldownRatio?: number;
  sub?: string;
}

const MAIN = 76;
const SMALL = 52;

const circleRadius = (d: number) => ({
  borderTopLeftRadius: d / 2,
  borderTopRightRadius: d / 2,
  borderBottomRightRadius: d / 2,
  borderBottomLeftRadius: d / 2,
});

function seedOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 97) + 5;
}

function PadButton({ action, size }: { action: PadAction; size: number }) {
  const d = size - 4;
  const path = wobbleRect(d, d, circleRadius(d), seedOf(action.key), {
    amp: 1.2,
    step: 9,
  });
  const cooling = action.cooldownRatio !== undefined && action.cooldownRatio > 0;
  const r = d / 2 - 3;
  const circumference = 2 * Math.PI * r;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled || cooling}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={[
        styles.btn,
        { width: size, height: size },
        (action.disabled || cooling) && styles.dim,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={path}
          x={2}
          y={2}
          fill={action.accent ? colors.accent : colors.paper}
          fillOpacity={action.accent ? 1 : 0.92}
          stroke={colors.ink}
          strokeWidth={2}
        />
        {cooling ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.accentDeep}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - (action.cooldownRatio ?? 0))}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      <Text
        style={[
          styles.label,
          { fontSize: size >= MAIN ? 17 : 14 },
          action.accent && styles.labelAccent,
        ]}
        numberOfLines={1}
      >
        {action.label}
      </Text>
      {action.sub ? (
        <Text style={[styles.sub, action.accent && styles.labelAccent]}>{action.sub}</Text>
      ) : null}
    </Pressable>
  );
}

export function ActionPad({
  main,
  secondaries = [],
  style,
}: {
  main: PadAction;
  secondaries?: PadAction[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pad, style]} pointerEvents="box-none">
      {secondaries.length > 0 ? (
        <View style={styles.row}>
          {secondaries.map((a) => (
            <PadButton key={a.key} action={a} size={SMALL} />
          ))}
        </View>
      ) : null}
      <PadButton action={main} size={MAIN} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: "flex-end", gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  btn: { alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.35 },
  label: { fontFamily: fonts.display, color: colors.ink },
  labelAccent: { color: colors.onAccent },
  sub: { fontSize: 10, fontWeight: "700", color: colors.grayDark, marginTop: -2 },
});
