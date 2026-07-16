/**
 * PartyMapArt — PARTY_MAP 가구를 그리는 정적 두들 SVG. 프레임 크기가 같으면
 * 리렌더하지 않도록 memo. 잉크 아웃라인 + kind별 소품 디테일, solid는 종이 채움,
 * rug/stage는 점선 아웃라인(통행 가능 티).
 */
import { memo } from "react";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import { PARTY_MAP, isSolid, type FurnitureDef } from "@mingle/shared";
import { wobbleRect } from "../../lib/doodle-path";
import { colors } from "../../lib/theme";

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 89) + 1;
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
      <Path
        d={outline}
        fill={solid ? colors.paper : "none"}
        stroke={colors.ink}
        strokeWidth={2}
        strokeDasharray={solid ? undefined : "6 5"}
        opacity={solid ? 1 : 0.55}
      />
      {f.kind === "bar" && (
        <>
          <Line
            x1={w * 0.2}
            y1={h * 0.3}
            x2={w * 0.2}
            y2={h * 0.62}
            stroke={colors.ink}
            strokeWidth={2}
          />
          <Line
            x1={w * 0.45}
            y1={h * 0.24}
            x2={w * 0.45}
            y2={h * 0.62}
            stroke={colors.ink}
            strokeWidth={2}
          />
          <Line
            x1={w * 0.7}
            y1={h * 0.34}
            x2={w * 0.7}
            y2={h * 0.62}
            stroke={colors.ink}
            strokeWidth={2}
          />
          <Line
            x1={w * 0.1}
            y1={h * 0.72}
            x2={w * 0.9}
            y2={h * 0.72}
            stroke={colors.ink}
            strokeWidth={1.4}
          />
        </>
      )}
      {f.kind === "table" && (
        <Circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) * 0.22}
          stroke={colors.ink}
          strokeWidth={1.6}
          fill="none"
        />
      )}
      {f.kind === "sofa" && (
        <Path
          d={`M${w * 0.1} ${h * 0.45} h${w * 0.8}`}
          stroke={colors.ink}
          strokeWidth={1.6}
          fill="none"
        />
      )}
      {f.kind === "dj" && (
        <>
          <Circle
            cx={w * 0.3}
            cy={h * 0.5}
            r={Math.min(w, h) * 0.2}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill="none"
          />
          <Circle
            cx={w * 0.7}
            cy={h * 0.5}
            r={Math.min(w, h) * 0.2}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill="none"
          />
        </>
      )}
      {f.kind === "plant" && (
        <>
          <Path
            d={`M${w / 2} ${h * 0.55} q${-w * 0.3} ${-h * 0.3} ${-w * 0.15} ${-h * 0.45}`}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill="none"
          />
          <Path
            d={`M${w / 2} ${h * 0.55} q${w * 0.3} ${-h * 0.3} ${w * 0.15} ${-h * 0.45}`}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill="none"
          />
          <Path
            d={`M${w / 2} ${h * 0.55} v${-h * 0.4}`}
            stroke={colors.ink}
            strokeWidth={1.6}
            fill="none"
          />
        </>
      )}
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
      {sorted.map((f) => (
        <FurniturePiece key={f.id} f={f} width={width} height={height} />
      ))}
    </Svg>
  );
});
