/**
 * PartyMapArt — PARTY_MAP 가구를 그리는 정적 두들 SVG. 프레임 크기가 같으면
 * 리렌더하지 않도록 memo. 잉크 아웃라인 + kind별 소품 디테일, solid는 종이 채움,
 * rug/stage는 점선 아웃라인(통행 가능 티).
 */
import { memo } from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { PARTY_MAP, isSolid, type FurnitureDef, type DecoDef } from "@mingle/shared";
import { wobbleRect } from "../../lib/doodle-path";
import { colors, doodle } from "../../lib/theme";
import { renderFurnitureDetail } from "./furniture";

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 89) + 1;
}

/** 우드 플랭크 바닥 — 성긴 가로줄 + 짧은 이음선(엇갈리게), 낮은 opacity 배경. */
function Floor({ width, height }: { width: number; height: number }) {
  const rows = 6;
  const lines = [];
  for (let i = 1; i < rows; i++) {
    const y = (height / rows) * i;
    lines.push(
      <Line
        key={`h${i}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={colors.grayLight}
        strokeWidth={1}
        opacity={0.5}
      />,
    );
    // 짧은 이음선(엇갈리게)
    const seam = width * (i % 2 === 0 ? 0.33 : 0.66);
    lines.push(
      <Line
        key={`v${i}`}
        x1={seam}
        y1={y}
        x2={seam}
        y2={y - height / rows}
        stroke={colors.grayLight}
        strokeWidth={1}
        opacity={0.4}
      />,
    );
  }
  return <>{lines}</>;
}

/** 비충돌 환경 소품(창문/액자/스트링라이트/얼룩) — kind별 간단 렌더. */
function Deco({ d, width, height }: { d: DecoDef; width: number; height: number }) {
  const x = d.x * width;
  const y = d.y * height;
  const w = d.w * width;
  const h = d.h * height;
  switch (d.kind) {
    case "window":
      return (
        <G x={x} y={y}>
          <Rect
            x={0}
            y={0}
            width={w}
            height={h}
            rx={3}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill={colors.paper}
            opacity={0.9}
          />
          <Line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke={colors.ink} strokeWidth={1.2} />
          <Line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={colors.ink} strokeWidth={1.2} />
        </G>
      );
    case "frame":
      return (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={2}
          stroke={colors.ink}
          strokeWidth={1.6}
          fill="none"
        />
      );
    case "stringlights":
      return (
        <G x={x} y={y}>
          <Path
            d={`M0 0 Q${w * 0.25} ${h} ${w * 0.5} ${h * 0.4} T${w} 0`}
            stroke={colors.ink}
            strokeWidth={1.2}
            fill="none"
            opacity={0.6}
          />
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => (
            <Circle
              key={i}
              cx={w * t}
              cy={h * 0.4 + Math.sin(t * 9) * 3}
              r={2}
              fill={colors.accentSoft}
            />
          ))}
        </G>
      );
    case "stain":
      return (
        <Path
          d={`M${x} ${y} a${w / 2} ${h / 2} 0 1 0 ${w} 0 a${w / 2} ${h / 2} 0 1 0 ${-w} 0`}
          fill={colors.ink}
          opacity={0.06}
        />
      );
  }
}

function FurniturePiece({ f, width, height }: { f: FurnitureDef; width: number; height: number }) {
  const x = f.x * width;
  const y = f.y * height;
  const w = f.w * width;
  const h = f.h * height;
  const solid = isSolid(f.kind);
  const r = Math.min(10, w / 4, h / 4);
  const outline = wobbleRect(
    w,
    h,
    {
      borderTopLeftRadius: r * 1.3,
      borderTopRightRadius: r * 0.8,
      borderBottomRightRadius: r * 1.5,
      borderBottomLeftRadius: r * 0.7,
    },
    seedOf(f.id),
  );
  return (
    <G x={x} y={y}>
      {solid && (
        <Path
          d={outline}
          fill={colors.ink}
          opacity={0.1}
          transform={`translate(${doodle.shadow.x * 0.5}, ${doodle.shadow.y * 0.5})`}
        />
      )}
      <Path
        d={outline}
        fill={solid ? colors.paper : "none"}
        stroke={colors.ink}
        strokeWidth={3.2}
        strokeDasharray={solid ? undefined : "6 5"}
        opacity={solid ? 1 : 0.55}
      />
      {renderFurnitureDetail(f.kind, w, h)}
    </G>
  );
}

export const PartyMapArt = memo(function PartyMapArt({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  if (width <= 0 || height <= 0) return null;
  // 통행 가능(rug/stage)을 먼저, solid를 위에 — 페인터 순서
  const sorted = [...PARTY_MAP.furniture].sort(
    (a, b) => Number(isSolid(a.kind)) - Number(isSolid(b.kind)),
  );
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Floor width={width} height={height} />
      {(PARTY_MAP.deco ?? []).map((d) => (
        <Deco key={d.id} d={d} width={width} height={height} />
      ))}
      {sorted.map((f) => (
        <FurniturePiece key={f.id} f={f} width={width} height={height} />
      ))}
    </Svg>
  );
});
