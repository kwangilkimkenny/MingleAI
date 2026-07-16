/**
 * DoodleCharacter — 손그림 인형 캐릭터(머리+몸통+팔다리 라인아트).
 * 애니메이션은 phase(ms 클록) 기반 순수 계산 — 이동 중일 때만 부모의 rAF 틱이
 * 리렌더를 일으키므로 별도 타이머/Reanimated 불필요(게임 내부 Motion 미적용 원칙).
 * facing은 SVG만 좌우 반전(이름표는 반전 금지).
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { mulberry, wobbleRect } from "../../lib/doodle-path";
import { colors } from "../../lib/theme";

/** size 대비 렌더 박스 배율 — 부모가 중심 배치 계산에 사용. */
export const CHAR_BOX = { w: 0.62, h: 1.3 } as const;

function seedOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 97) + 1;
}

export const DoodleCharacter = memo(function DoodleCharacter({
  name,
  mine,
  walking,
  facing,
  phase,
  ghost = false,
  size = 44,
}: {
  name: string;
  mine: boolean;
  walking: boolean;
  facing: 1 | -1;
  phase: number;
  ghost?: boolean;
  size?: number;
}) {
  const w = size * CHAR_BOX.w;
  const h = size;
  const headR = size * 0.24;
  const cx = w / 2;
  const headCy = headR + 2;
  const hipY = size * 0.72;
  const seed = seedOf(name);
  const headPath = wobbleRect(
    headR * 2,
    headR * 2,
    {
      borderTopLeftRadius: headR,
      borderTopRightRadius: headR,
      borderBottomRightRadius: headR,
      borderBottomLeftRadius: headR,
    },
    seed,
    { amp: 0.9, step: 7 },
  );
  // 걷기 스윙: sin 파형. 정지 시 살짝 벌린 기본 자세.
  const swing = walking ? Math.sin(phase / 110) : 0.35;
  const bob = walking ? Math.sin(phase / 110) * 2 : 0;
  const limb = size * 0.22;
  const face = mine ? colors.ink : colors.paper;
  const feat = mine ? colors.paper : colors.ink;
  // 유령 몸: 물결 치맛단 (다리 대신)
  const rand = mulberry(seed);
  const ghostHem = `M${cx - headR} ${hipY} q${headR / 2} ${4 + rand() * 3} ${headR} 0 q${headR / 2} ${-4 - rand() * 3} ${headR} 0`;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.tag, mine && styles.tagMine]}>
        <Text style={[styles.tagText, mine && styles.tagTextMine]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View
        style={{
          transform: [{ scaleX: facing }, { translateY: bob }],
          opacity: ghost ? 0.45 : 1,
        }}
      >
        <Svg width={w} height={h}>
          {/* 몸통 */}
          <Line
            x1={cx}
            y1={headCy + headR - 2}
            x2={cx}
            y2={hipY}
            stroke={colors.ink}
            strokeWidth={2}
          />
          {/* 팔 */}
          <Line
            x1={cx}
            y1={headCy + headR + 4}
            x2={cx - limb * Math.cos(0.9 - swing * 0.5)}
            y2={headCy + headR + 4 + limb * Math.sin(0.9 - swing * 0.5)}
            stroke={colors.ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Line
            x1={cx}
            y1={headCy + headR + 4}
            x2={cx + limb * Math.cos(0.9 + swing * 0.5)}
            y2={headCy + headR + 4 + limb * Math.sin(0.9 + swing * 0.5)}
            stroke={colors.ink}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* 다리 or 유령 치맛단 */}
          {ghost ? (
            <Path d={ghostHem} stroke={colors.ink} strokeWidth={2} fill="none" />
          ) : (
            <>
              <Line
                x1={cx}
                y1={hipY}
                x2={cx - limb * 0.7 * Math.sin(swing)}
                y2={h - 2}
                stroke={colors.ink}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Line
                x1={cx}
                y1={hipY}
                x2={cx + limb * 0.7 * Math.sin(swing)}
                y2={h - 2}
                stroke={colors.ink}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </>
          )}
          {/* 머리 (몸 위에 그려 겹침 정리) */}
          <Path
            d={headPath}
            x={cx - headR}
            y={headCy - headR}
            fill={face}
            stroke={colors.ink}
            strokeWidth={2}
          />
          {/* 눈 + 입 */}
          <Circle cx={cx - headR * 0.35} cy={headCy - 1} r={1.6} fill={feat} />
          <Circle cx={cx + headR * 0.35} cy={headCy - 1} r={1.6} fill={feat} />
          <Path
            d={`M${cx - 3} ${headCy + headR * 0.35} q3 3 6 0`}
            stroke={feat}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
});

/** 어몽 시체 — 누운 몸 + X 눈. */
export function DoodleCorpse({ size = 40 }: { size?: number }) {
  const headR = size * 0.22;
  const cy = size * 0.55;
  return (
    <View pointerEvents="none" style={{ transform: [{ rotate: "-8deg" }] }}>
      <Svg width={size} height={size * 0.8}>
        {/* 누운 몸통 */}
        <Line
          x1={headR * 2}
          y1={cy}
          x2={size - 4}
          y2={cy}
          stroke={colors.ink}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* 머리 */}
        <Circle cx={headR + 2} cy={cy} r={headR} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
        {/* X 눈 */}
        <Path
          d={`M${headR - 1} ${cy - 3} l3 3 m0 -3 l-3 3 M${headR + 4} ${cy - 3} l3 3 m0 -3 l-3 3`}
          stroke={colors.ink}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  tag: {
    maxWidth: 76,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: colors.ink,
    backgroundColor: "rgba(255,255,255,0.85)",
    marginBottom: 2,
  },
  tagMine: { backgroundColor: colors.ink },
  tagText: { fontSize: 10, fontWeight: "700", color: colors.ink },
  tagTextMine: { color: colors.paper },
});
