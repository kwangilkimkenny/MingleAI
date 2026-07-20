/**
 * Furniture detail illustrations — kind별 가구 내부 디테일(굵은 마커 스트로크).
 * 아웃라인(+접지 그림자)은 PartyMapArt의 FurniturePiece가 그린다. Svg 컨텍스트
 * 안에서 호출되므로 여기서는 Path/Circle/Line/Rect 등 도형 프리미티브만 반환한다.
 */
import type { ReactNode } from "react";
import { Circle, Line, Path, Rect } from "react-native-svg";
import type { FurnitureKind } from "@mingle/shared";
import { colors } from "../../../lib/theme";

const ink = colors.ink;
// 볼드 마커 두들 원칙: 디테일 stroke는 2.4(얇은 라인 금지) — 아웃라인 3.2보다 한 단
// 얇게 유지해 위계를 준다.

/** kind별 가구 내부 디테일(아웃라인은 FurniturePiece가 그림). 좌표는 0..w, 0..h. */
export function renderFurnitureDetail(kind: FurnitureKind, w: number, h: number): ReactNode {
  switch (kind) {
    case "bar":
      return (
        <>
          {/* 카운터 상판 해칭 */}
          <Line
            x1={w * 0.08}
            y1={h * 0.68}
            x2={w * 0.92}
            y2={h * 0.68}
            stroke={ink}
            strokeWidth={2.4}
          />
          {/* 병 3 */}
          {[0.25, 0.42, 0.59].map((t, i) => (
            <Rect
              key={i}
              x={w * t}
              y={h * (0.28 - i * 0.02)}
              width={w * 0.05}
              height={h * 0.36}
              rx={2}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
            />
          ))}
          {/* 스툴 2 */}
          {[0.2, 0.75].map((t, i) => (
            <Circle
              key={`s${i}`}
              cx={w * t}
              cy={h * 0.86}
              r={Math.min(w, h) * 0.08}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
            />
          ))}
        </>
      );
    case "table":
      return (
        <>
          <Circle
            cx={w / 2}
            cy={h / 2}
            r={Math.min(w, h) * 0.26}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
          />
          {/* 컵·접시 */}
          <Circle cx={w * 0.4} cy={h * 0.45} r={2.4} stroke={ink} strokeWidth={2.4} fill="none" />
          <Circle cx={w * 0.6} cy={h * 0.55} r={3} stroke={ink} strokeWidth={2.4} fill="none" />
          {/* 의자 2 */}
          {[0.12, 0.88].map((t, i) => (
            <Rect
              key={i}
              x={w * t - w * 0.05}
              y={h * 0.4}
              width={w * 0.1}
              height={h * 0.2}
              rx={2}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
            />
          ))}
        </>
      );
    case "sofa":
      return (
        <>
          <Path
            d={`M${w * 0.1} ${h * 0.5} h${w * 0.8}`}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
          />
          {/* 쿠션 분할 + 팔걸이 */}
          <Line
            x1={w * 0.5}
            y1={h * 0.3}
            x2={w * 0.5}
            y2={h * 0.62}
            stroke={ink}
            strokeWidth={2.4}
          />
          <Path
            d={`M${w * 0.06} ${h * 0.35} v${h * 0.35}`}
            stroke={ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <Path
            d={`M${w * 0.94} ${h * 0.35} v${h * 0.35}`}
            stroke={ink}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </>
      );
    case "dj":
      return (
        <>
          {/* 턴테이블 2 */}
          {[0.3, 0.7].map((t, i) => (
            <Circle
              key={i}
              cx={w * t}
              cy={h * 0.5}
              r={Math.min(w, h) * 0.22}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
            />
          ))}
          {[0.3, 0.7].map((t, i) => (
            <Circle key={`d${i}`} cx={w * t} cy={h * 0.5} r={2} fill={ink} />
          ))}
          {/* 믹서 노브 */}
          {[0.42, 0.5, 0.58].map((t, i) => (
            <Circle
              key={`k${i}`}
              cx={w * t}
              cy={h * 0.82}
              r={1.6}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
            />
          ))}
        </>
      );
    case "plant":
      return (
        <>
          {/* 화분 무늬 */}
          <Rect
            x={w * 0.28}
            y={h * 0.58}
            width={w * 0.44}
            height={h * 0.36}
            rx={3}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
          />
          <Line
            x1={w * 0.28}
            y1={h * 0.66}
            x2={w * 0.72}
            y2={h * 0.66}
            stroke={ink}
            strokeWidth={2.4}
          />
          {/* 잎 클러스터 */}
          {[-0.28, -0.1, 0.1, 0.28].map((t, i) => (
            <Path
              key={i}
              d={`M${w / 2} ${h * 0.58} q${w * t * 1.4} ${-h * 0.3} ${w * t} ${-h * 0.5}`}
              stroke={ink}
              strokeWidth={2.4}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </>
      );
    case "stage":
    case "rug":
      return null; // 통행 가능 — 아웃라인(점선)만
  }
}
