/**
 * DoodleCharacter — 손그림 인형 캐릭터(머리+몸통+팔다리 라인아트).
 * 애니메이션은 phase(ms 클록) 기반 순수 계산 — 이동 중일 때만 부모의 rAF 틱이
 * 리렌더를 일으키므로 별도 타이머/Reanimated 불필요(게임 내부 Motion 미적용 원칙).
 * facing은 SVG만 좌우 반전(이름표는 반전 금지).
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { mulberry, wobbleRect } from "../../lib/doodle-path";
import { lookFor } from "../../lib/character-look";
import type { Hair, Outfit, Eyes, Mouth } from "../../lib/character-look";
import { colors } from "../../lib/theme";

/** size 대비 렌더 박스 배율 — 부모가 중심 배치 계산에 사용. */
export const CHAR_BOX = { w: 0.62, h: 1.3 } as const;

export function DoodleCharacter({
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
  const look = lookFor(name);
  const w = size * CHAR_BOX.w;
  const h = size;
  const headR = size * 0.32; // 큰 머리(치비 2등신)
  const cx = w / 2;
  const headCy = headR + 2;
  const bodyTop = headCy + headR - 3;
  const hipY = size * 0.86; // 짧은 몸통
  const swing = walking ? Math.sin(phase / 110) : 0.3;
  const bob = walking ? Math.sin(phase / 110) * 2.6 : Math.sin(phase / 600) * 0.8; // 걷기 통통 / 정지 숨쉬기
  const limb = size * 0.18;
  // 볼드 마커 두들(Chanoir풍 레퍼런스): 얇은 라인 금지 — 마커펜처럼 굵게.
  const inkW = Math.max(3.5, size * 0.09); // 팔·다리·디테일 기본 굵기
  const outlineW = Math.max(4.5, size * 0.11); // 머리·몸통 외곽(더 굵게)
  const face = mine ? colors.ink : colors.paper;
  const feat = mine ? colors.paper : colors.ink;
  const rand = mulberry(look.seed);
  const ghostHem = `M${cx - headR} ${hipY} q${headR / 2} ${4 + rand() * 3} ${headR} 0 q${headR / 2} ${-4 - rand() * 3} ${headR} 0`;
  const headPath = wobbleRect(
    headR * 2,
    headR * 2,
    {
      borderTopLeftRadius: headR,
      borderTopRightRadius: headR,
      borderBottomRightRadius: headR,
      borderBottomLeftRadius: headR,
    },
    look.seed,
    { amp: 0.8, step: 8 },
  );
  const bodyW = size * 0.42;
  const bodyPath = wobbleRect(
    bodyW,
    hipY - bodyTop,
    {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 5,
      borderBottomLeftRadius: 5,
    },
    look.seed,
    { amp: 0.7, step: 9 },
  );

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
        <Svg width={w} height={h} style={styles.svgOverflow}>
          {/* 다리 or 유령 치맛단 */}
          {ghost ? (
            <Path d={ghostHem} stroke={colors.ink} strokeWidth={inkW} fill="none" />
          ) : (
            <>
              <Line
                x1={cx - 3}
                y1={hipY}
                x2={cx - 3 - limb * 0.6 * Math.sin(swing)}
                y2={h - 2}
                stroke={colors.ink}
                strokeWidth={inkW}
                strokeLinecap="round"
              />
              <Line
                x1={cx + 3}
                y1={hipY}
                x2={cx + 3 + limb * 0.6 * Math.sin(swing)}
                y2={h - 2}
                stroke={colors.ink}
                strokeWidth={inkW}
                strokeLinecap="round"
              />
            </>
          )}
          {/* 둥근 몸통(상의 실루엣) + outfit 디테일 */}
          <Path
            d={bodyPath}
            x={cx - bodyW / 2}
            y={bodyTop}
            fill={colors.paper}
            stroke={colors.ink}
            strokeWidth={outlineW}
            strokeLinejoin="round"
          />
          <OutfitDetail outfit={look.outfit} cx={cx} bodyTop={bodyTop} bodyW={bodyW} hipY={hipY} />
          {/* 팔(굵은 마커) */}
          <Line
            x1={cx}
            y1={bodyTop + 4}
            x2={cx - limb * Math.cos(0.8 - swing * 0.5)}
            y2={bodyTop + 4 + limb * Math.sin(0.8 - swing * 0.5)}
            stroke={colors.ink}
            strokeWidth={inkW}
            strokeLinecap="round"
          />
          <Line
            x1={cx}
            y1={bodyTop + 4}
            x2={cx + limb * Math.cos(0.8 + swing * 0.5)}
            y2={bodyTop + 4 + limb * Math.sin(0.8 + swing * 0.5)}
            stroke={colors.ink}
            strokeWidth={inkW}
            strokeLinecap="round"
          />
          {/* 머리(굵은 외곽) */}
          <Path
            d={headPath}
            x={cx - headR}
            y={headCy - headR}
            fill={face}
            stroke={colors.ink}
            strokeWidth={outlineW}
          />
          <Hairstyle hair={look.hair} cx={cx} headCy={headCy} headR={headR} />
          {/* 볼터치(accentFill) — 유일한 코랄 포인트. 내 캐릭터는 잉크 머리라 생략, look.accent==="cheek"인 캐릭터만 */}
          {!mine && look.accent === "cheek" && (
            <>
              <Circle
                cx={cx - headR * 0.58}
                cy={headCy + headR * 0.3}
                r={headR * 0.18}
                fill={colors.accentFill}
                opacity={0.9}
              />
              <Circle
                cx={cx + headR * 0.58}
                cy={headCy + headR * 0.3}
                r={headR * 0.18}
                fill={colors.accentFill}
                opacity={0.9}
              />
            </>
          )}
          {/* 눈/입 — 파츠 분기(마커 두께) */}
          <FaceFeatures
            eyes={look.eyes}
            mouth={look.mouth}
            cx={cx}
            headCy={headCy}
            headR={headR}
            feat={feat}
            face={face}
          />
        </Svg>
      </View>
    </View>
  );
}

/** 어몽 시체 — 누운 몸 + X 눈. */
export function DoodleCorpse({ size = 40 }: { size?: number }) {
  const headR = size * 0.22;
  const cy = size * 0.55;
  return (
    <View pointerEvents="none" style={{ transform: [{ rotate: "-8deg" }] }}>
      <Svg width={size} height={size * 0.8} style={styles.svgOverflow}>
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
        <Circle
          cx={headR + 2}
          cy={cy}
          r={headR}
          fill={colors.paper}
          stroke={colors.ink}
          strokeWidth={2}
        />
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

function Hairstyle({
  hair,
  cx,
  headCy,
  headR,
}: {
  hair: Hair;
  cx: number;
  headCy: number;
  headR: number;
}) {
  const top = headCy - headR;
  const iw = 3.2; // 볼드 마커
  switch (hair) {
    case "short":
      return (
        <Path
          d={`M${cx - headR} ${headCy - headR * 0.2} q${headR} ${-headR * 1.4} ${headR * 2} 0`}
          stroke={colors.ink}
          strokeWidth={iw}
          fill={colors.ink}
        />
      );
    case "bob":
      return (
        <Path
          d={`M${cx - headR - 1} ${headCy} q0 ${-headR * 1.5} ${headR + 1} ${-headR * 1.5} q${headR + 1} 0 ${headR + 1} ${headR * 1.5} l0 2 q${-headR} ${-6} ${-headR * 2} 0 z`}
          fill={colors.ink}
          stroke={colors.ink}
          strokeWidth={1}
        />
      );
    case "ponytail":
      return (
        <>
          <Path
            d={`M${cx - headR} ${headCy - headR * 0.3} q${headR} ${-headR * 1.3} ${headR * 2} 0`}
            fill={colors.ink}
            stroke={colors.ink}
            strokeWidth={iw}
          />
          <Path
            d={`M${cx + headR * 0.8} ${top + headR * 0.4} q${headR * 0.9} ${headR * 0.3} ${headR * 0.4} ${headR * 1.4}`}
            stroke={colors.ink}
            strokeWidth={iw + 1}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case "curly":
      return (
        <>
          {[-0.7, -0.25, 0.25, 0.7].map((t, i) => (
            <Circle
              key={i}
              cx={cx + headR * t}
              cy={top + headR * 0.25}
              r={headR * 0.3}
              fill={colors.ink}
            />
          ))}
        </>
      );
    case "twoblock":
      return (
        <Path
          d={`M${cx - headR} ${headCy - headR * 0.5} q${headR} ${-headR} ${headR * 2} 0 l0 ${headR * 0.35} q${-headR} ${-headR * 0.5} ${-headR * 2} 0 z`}
          fill={colors.ink}
        />
      );
    case "bowl":
      return (
        <Path
          d={`M${cx - headR - 1} ${headCy - headR * 0.1} q0 ${-headR * 1.4} ${headR + 1} ${-headR * 1.4} q${headR + 1} 0 ${headR + 1} ${headR * 1.4} q${-headR} ${-4} ${-headR * 2} 0 z`}
          fill={colors.ink}
        />
      );
  }
}

function OutfitDetail({
  outfit,
  cx,
  bodyTop,
  bodyW,
  hipY,
}: {
  outfit: Outfit;
  cx: number;
  bodyTop: number;
  bodyW: number;
  hipY: number;
}) {
  const iw = 2.4; // 볼드 마커
  const midY = (bodyTop + hipY) / 2;
  switch (outfit) {
    case "tee":
      return (
        <Path
          d={`M${cx - bodyW * 0.28} ${bodyTop + 2} q${bodyW * 0.28} 5 ${bodyW * 0.56} 0`}
          stroke={colors.ink}
          strokeWidth={iw}
          fill="none"
        />
      );
    case "hoodie":
      return (
        <>
          <Path
            d={`M${cx - bodyW * 0.3} ${bodyTop + 1} q${bodyW * 0.3} 7 ${bodyW * 0.6} 0`}
            stroke={colors.ink}
            strokeWidth={iw}
            fill="none"
          />
          <Line
            x1={cx - 2}
            y1={bodyTop + 3}
            x2={cx - 2}
            y2={midY}
            stroke={colors.accentSoft}
            strokeWidth={iw}
            strokeLinecap="round"
          />
          <Line
            x1={cx + 2}
            y1={bodyTop + 3}
            x2={cx + 2}
            y2={midY}
            stroke={colors.accentSoft}
            strokeWidth={iw}
            strokeLinecap="round"
          />
        </>
      );
    case "overall":
      return (
        <>
          <Line
            x1={cx - bodyW * 0.22}
            y1={bodyTop + 1}
            x2={cx - bodyW * 0.22}
            y2={midY}
            stroke={colors.ink}
            strokeWidth={iw}
          />
          <Line
            x1={cx + bodyW * 0.22}
            y1={bodyTop + 1}
            x2={cx + bodyW * 0.22}
            y2={midY}
            stroke={colors.ink}
            strokeWidth={iw}
          />
          <Line
            x1={cx - bodyW * 0.3}
            y1={midY}
            x2={cx + bodyW * 0.3}
            y2={midY}
            stroke={colors.ink}
            strokeWidth={iw}
          />
        </>
      );
    case "dress":
      return (
        <Path
          d={`M${cx - bodyW * 0.3} ${midY} L${cx - bodyW * 0.5} ${hipY} M${cx + bodyW * 0.3} ${midY} L${cx + bodyW * 0.5} ${hipY}`}
          stroke={colors.ink}
          strokeWidth={iw}
          fill="none"
        />
      );
  }
}

function FaceFeatures({
  eyes,
  mouth,
  cx,
  headCy,
  headR,
  feat,
  face,
}: {
  eyes: Eyes;
  mouth: Mouth;
  cx: number;
  headCy: number;
  headR: number;
  feat: string;
  face: string;
}) {
  const ex = headR * 0.34;
  const ey = headCy - headR * 0.05;
  const eyeNode = (sign: number) => {
    if (eyes === "half")
      return (
        <Path
          key={sign}
          d={`M${cx + sign * ex - 2.6} ${ey} q2.6 3 5.2 0`}
          stroke={feat}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
      );
    const r = eyes === "round" ? 3.4 : 3;
    return (
      <React.Fragment key={sign}>
        <Circle cx={cx + sign * ex} cy={ey} r={r} fill={feat} />
        <Circle cx={cx + sign * ex + 1} cy={ey - 1} r={1} fill={face} />
      </React.Fragment>
    );
  };
  const my = headCy + headR * 0.42;
  const mouthNode =
    mouth === "o" ? (
      <Circle cx={cx} cy={my} r={2.2} fill="none" stroke={feat} strokeWidth={2.4} />
    ) : mouth === "line" ? (
      <Line
        x1={cx - 3.5}
        y1={my}
        x2={cx + 3.5}
        y2={my}
        stroke={feat}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    ) : (
      <Path
        d={`M${cx - 4} ${my - 1} q4 4 8 0`}
        stroke={feat}
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
      />
    );
  return (
    <>
      {eyeNode(-1)}
      {eyeNode(1)}
      {mouthNode}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  // 굵은 outlineW(머리/몸통 마커 외곽)가 렌더 박스 폭을 넘어서므로 클리핑 방지.
  svgOverflow: { overflow: "visible" },
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
