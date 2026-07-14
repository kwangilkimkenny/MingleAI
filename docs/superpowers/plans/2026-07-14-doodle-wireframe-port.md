# 두들 와이어프레임 → apps/mobile 이식 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/design/mobile-wireframes.html`(흑백 두들 6화면)의 디자인 언어 — 워블(손그림) 보더, 단색 오프셋 그림자, 해칭 게이지, 반전 잉크 블록, 두들 얼굴, 삐뚤 칩, 두들 탭바 — 를 기존 v2 모바일 전 화면에 이식한다.

**Architecture:** 순수 함수(`src/lib/doodle-path.ts`)가 시드 기반 SVG 워블 패스를 생성하고(vitest 검증), `react-native-svg` 기반 프리미티브(`WobbleBox`/`MatchGauge`/`DoodleFace`/`DoodleChip`)가 이를 렌더한다. 기존 `Doodle.tsx`(DoodleCard/ShadowBox/DoodleButton)는 내부만 WobbleBox로 교체해 **API 불변** — 전 화면이 자동 업그레이드된다. 화면별 작업은 구조 변경 없이 와이어프레임 패턴(앱바·반전 카드·배지·행 구분선)을 입힌다.

**Tech Stack:** RN 0.85 + Expo SDK 56, `react-native-svg`(기설치), Vitest(순수 lib), 신규 의존성 **0**.

## Global Constraints

- 신규 npm 의존성 금지. `react-native-svg`·`lucide-react-native`·Gaegu만 사용 (모두 기설치).
- 색: `src/lib/theme.ts` `colors` 토큰만. 유채색 하드코딩 금지. **포인트 컬러 = `colors.accent`(#C2185B) — 화면당 primary CTA 1개·활성 탭·안읽음 배지만** (CLAUDE.md 규칙이 와이어프레임 zero-chroma를 대체).
- `feTurbulence`/`feDisplacementMap` 사용 금지 — react-native-svg 네이티브 필터 미지원. 워블은 **미리 계산한 지터 패스**(`doodle-path.ts`)로 구현 (DESIGN.md §3 "미리 렌더한 SVG 보더" 경로).
- `DoodleButton`은 **FLAT 유지** (잉크 외곽선, 그림자 없음 — 기존 확정 결정). 오프셋 그림자는 카드·탭바만.
- 손글씨(Gaegu) 14px 미만 긴 본문 금지. RN `<Button>` 금지.
- 백엔드/shared/client-core 변경 금지 (T6의 client-core `getMyProfile` 소비는 기존 API).
- 게임 내부 UI(`among/*`, 밸런스 게임 카드, `PartyRoomCanvas` 내부)는 **변경 금지** — 화면 크롬(앱바·버튼·카드 래핑)만.
- 각 태스크 종료 시: `pnpm --filter @mingle/mobile exec tsc --noEmit` 클린 + `pnpm --filter @mingle/mobile test` 그린 + 커밋.
- Prettier: double quotes, trailingComma all, printWidth 100.
- 워크트리: `/Users/namuneulbo/Desktop/MingleAI/.claude/worktrees/mobile-pivot-plan` (브랜치 `megahuni`). 모든 경로는 이 워크트리 기준.

---

### Task 1: 순수 워블 패스 라이브러리 `doodle-path.ts`

**Files:**
- Create: `apps/mobile/src/lib/doodle-path.ts`
- Test: `apps/mobile/src/lib/__tests__/doodle-path.test.ts`

**Interfaces:**
- Produces:
  - `wobbleRect(w: number, h: number, radius: WonkyRadius, seed: number, opts?: { amp?: number; step?: number }): string` — 닫힌 SVG 패스(`M … Z`). 모서리는 quadratic 곡선, 변은 `step`(기본 14px) 간격 정점에 `±amp`(기본 1.6px) 지터.
  - `hatchSegments(w: number, h: number, spacing?: number): Array<{ x1: number; y1: number; x2: number; y2: number }>` — 45° 해칭 선분들 (게이지/커버 채움), `spacing` 기본 5.5.
  - `mulberry(seed: number): () => number` — 결정적 PRNG (0..1).
  - `WonkyRadius` 타입 re-export (`theme.ts`와 동일 shape: `borderTopLeftRadius` 등 4키).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// apps/mobile/src/lib/__tests__/doodle-path.test.ts
import { describe, expect, it } from "vitest";
import { hatchSegments, mulberry, wobbleRect } from "../doodle-path";

const RADIUS = {
  borderTopLeftRadius: 18,
  borderTopRightRadius: 10,
  borderBottomRightRadius: 20,
  borderBottomLeftRadius: 12,
};

describe("mulberry", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry(7);
    const b = mulberry(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("stays in [0, 1)", () => {
    const r = mulberry(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("wobbleRect", () => {
  it("returns a closed path that starts with M", () => {
    const d = wobbleRect(200, 100, RADIUS, 1);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trimEnd().endsWith("Z")).toBe(true);
  });
  it("is deterministic per seed and differs across seeds", () => {
    expect(wobbleRect(200, 100, RADIUS, 5)).toEqual(wobbleRect(200, 100, RADIUS, 5));
    expect(wobbleRect(200, 100, RADIUS, 5)).not.toEqual(wobbleRect(200, 100, RADIUS, 6));
  });
  it("keeps every coordinate within amp of the box", () => {
    const d = wobbleRect(200, 100, RADIUS, 2, { amp: 2 });
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(-2.5);
      expect(nums[i]).toBeLessThanOrEqual(202.5);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(-2.5);
      expect(nums[i + 1]).toBeLessThanOrEqual(102.5);
    }
  });
  it("handles boxes smaller than the radii without NaN", () => {
    const d = wobbleRect(24, 20, RADIUS, 3);
    expect(d).not.toMatch(/NaN/);
  });
});

describe("hatchSegments", () => {
  it("covers the box with 45deg segments inside bounds", () => {
    const segs = hatchSegments(60, 16);
    expect(segs.length).toBeGreaterThan(5);
    for (const s of segs) {
      for (const v of [s.x1, s.x2]) expect(v).toBeGreaterThanOrEqual(-0.01);
      for (const v of [s.x1, s.x2]) expect(v).toBeLessThanOrEqual(60.01);
      for (const v of [s.y1, s.y2]) expect(v).toBeGreaterThanOrEqual(-0.01);
      for (const v of [s.y1, s.y2]) expect(v).toBeLessThanOrEqual(16.01);
    }
  });
  it("returns no segments for zero width", () => {
    expect(hatchSegments(0, 16)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- doodle-path`
Expected: FAIL — `Cannot find module '../doodle-path'` 계열.

- [ ] **Step 3: 최소 구현**

```ts
// apps/mobile/src/lib/doodle-path.ts
/**
 * Pure doodle-path generators for the hand-drawn (wobble) border system.
 * feTurbulence is unsupported in react-native-svg on native, so the "wobble" is a
 * pre-computed jittered path: straight edges become short segments whose vertices are
 * displaced by a seeded PRNG, corners stay quadratic curves. Deterministic per seed so
 * a surface never "boils" across re-renders.
 */

export type WonkyRadius = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/** mulberry32 — tiny deterministic PRNG, returns floats in [0, 1). */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function edgePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  step: number,
  amp: number,
  rand: () => number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.round(len / step));
  // Perpendicular unit vector for jitter displacement.
  const px = len === 0 ? 0 : -dy / len;
  const py = len === 0 ? 0 : dx / len;
  let d = "";
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const j = (rand() * 2 - 1) * amp;
    d += ` L${(x1 + dx * t + px * j).toFixed(2)} ${(y1 + dy * t + py * j).toFixed(2)}`;
  }
  return d + ` L${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Closed hand-drawn rounded-rect path: jittered edges + quadratic corners. */
export function wobbleRect(
  w: number,
  h: number,
  radius: WonkyRadius,
  seed: number,
  opts?: { amp?: number; step?: number },
): string {
  const amp = opts?.amp ?? 1.6;
  const step = opts?.step ?? 14;
  const rand = mulberry(seed);
  // Clamp radii so tiny boxes stay valid (mirrors CSS border-radius overlap rules).
  const s = Math.min(1, w / 2 / Math.max(radius.borderTopLeftRadius, radius.borderBottomLeftRadius, 1), h / 2 / Math.max(radius.borderTopLeftRadius, radius.borderTopRightRadius, 1));
  const tl = radius.borderTopLeftRadius * s;
  const tr = radius.borderTopRightRadius * s;
  const br = radius.borderBottomRightRadius * s;
  const bl = radius.borderBottomLeftRadius * s;
  let d = `M${tl.toFixed(2)} 0`;
  d += edgePoints(tl, 0, w - tr, 0, step, amp, rand);
  d += ` Q${w.toFixed(2)} 0 ${w.toFixed(2)} ${tr.toFixed(2)}`;
  d += edgePoints(w, tr, w, h - br, step, amp, rand);
  d += ` Q${w.toFixed(2)} ${h.toFixed(2)} ${(w - br).toFixed(2)} ${h.toFixed(2)}`;
  d += edgePoints(w - br, h, bl, h, step, amp, rand);
  d += ` Q0 ${h.toFixed(2)} 0 ${(h - bl).toFixed(2)}`;
  d += edgePoints(0, h - bl, 0, tl, step, amp, rand);
  d += ` Q0 0 ${tl.toFixed(2)} 0 Z`;
  return d;
}

/** 45° hatch line segments clipped to a w×h box — the B&W "marker fill". */
export function hatchSegments(
  w: number,
  h: number,
  spacing = 5.5,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  if (w <= 0 || h <= 0) return [];
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  // Lines of slope -1 (45°): x + y = c, c from 0..w+h.
  for (let c = spacing; c < w + h; c += spacing) {
    const x1 = Math.max(0, c - h);
    const y1 = Math.min(h, c);
    const x2 = Math.min(w, c);
    const y2 = Math.max(0, c - w);
    segs.push({ x1, y1, x2, y2 });
  }
  return segs;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @mingle/mobile test -- doodle-path`
Expected: PASS (전 케이스).

- [ ] **Step 5: 커밋**

```bash
git add apps/mobile/src/lib/doodle-path.ts apps/mobile/src/lib/__tests__/doodle-path.test.ts
git commit -m "feat(mobile): 시드 기반 워블 패스·해칭 순수 라이브러리 doodle-path"
```

---

### Task 2: SVG 두들 프리미티브 `DoodleSvg.tsx` (WobbleBox·MatchGauge·DoodleFace·DoodleChip)

**Files:**
- Create: `apps/mobile/src/components/DoodleSvg.tsx`

**Interfaces:**
- Consumes: Task 1의 `wobbleRect`/`hatchSegments`/`WonkyRadius`.
- Produces (전부 named export):
  - `WobbleBox({ children, radius, seed?, bg?, stroke?, strokeWidth?, shadow?, rotate?, style, contentStyle })` — onLayout으로 실측 후 SVG 워블 보더(+선택 오프셋 그림자 패스)를 콘텐츠 뒤에 절대배치. `seed` 기본 1, `bg` 기본 `colors.paper`, `strokeWidth` 기본 2.2, `shadow`(boolean) 기본 false → true면 `doodle.shadow` 오프셋의 잉크 채움 패스 추가.
  - `MatchGauge({ label, value, seed? })` — 라벨 행(Gaegu 라벨 + 숫자) + 워블 트랙 + `value`%(0–100) 해칭 채움.
  - `DoodleFace({ size?, variant?, inverted?, seed? })` — 손그림 원 얼굴. `variant: "smile" | "flat" | "open"` 기본 smile, `inverted` 기본 false(잉크 채움 + 흰 이목구비), `size` 기본 44.
  - `DoodleChip({ label, on?, tiny?, onPress? })` — 삐뚤 보더 칩. `on`이면 잉크 반전(검정 배경·흰 글자).

- [ ] **Step 1: 구현**

```tsx
// apps/mobile/src/components/DoodleSvg.tsx
/**
 * SVG doodle primitives — the wireframe's hand-drawn language, RN-native.
 * Borders are pre-computed jittered paths (doodle-path.ts), NOT feTurbulence
 * (unsupported in react-native-svg on native). Seeds are stable per element so
 * nothing re-wobbles on re-render.
 */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
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
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size && d ? (
        <Svg
          pointerEvents="none"
          style={{ position: "absolute", left: -PAD, top: -PAD }}
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
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

export function MatchGauge({ label, value, seed = 9 }: { label: string; value: number; seed?: number }) {
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
          <Svg width={w + PAD} height={H + PAD} viewBox={`${-PAD / 2} ${-PAD / 2} ${w + PAD} ${H + PAD}`} style={{ position: "absolute", left: -PAD / 2, top: -PAD / 2 }}>
            <Path d={trackD} fill={colors.paper} stroke={colors.ink} strokeWidth={1.9} />
            {hatchSegments(fillW, H).map((s, i) => (
              <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={colors.ink} strokeWidth={2.2} />
            ))}
            {fillW > 2 ? <Line x1={fillW} y1={0} x2={fillW} y2={H} stroke={colors.ink} strokeWidth={2} /> : null}
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
  const circleD = wobbleRect(R * 2, R * 2, {
    borderTopLeftRadius: R, borderTopRightRadius: R, borderBottomRightRadius: R, borderBottomLeftRadius: R,
  }, seed, { amp: 1.2, step: 9 });
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
      <Path d={mouth} fill={variant === "open" ? feat : "none"} stroke={feat} strokeWidth={2.6} strokeLinecap="round" />
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
      contentStyle={tiny ? styles.chipTiny : styles.chipInner}
    >
      <Text style={[tiny ? styles.chipTextTiny : styles.chipText, { color: on ? colors.paper : colors.ink }]}>
        {label}
      </Text>
    </WobbleBox>
  );
  return onPress ? <Pressable onPress={onPress}>{chip}</Pressable> : chip;
}

const styles = StyleSheet.create({
  wobbleOuter: { position: "relative" },
  gauge: { marginVertical: 6 },
  gaugeLab: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  gaugeLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  gaugeValue: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  chipInner: { paddingVertical: 5, paddingHorizontal: 13 },
  chipTiny: { paddingVertical: 2, paddingHorizontal: 9 },
  chipText: { fontFamily: fonts.display, fontSize: 15 },
  chipTextTiny: { fontFamily: fonts.display, fontSize: 12 },
});
```

주의: `Rect` import 미사용 시 제거(tsc `noUnusedLocals` 여부는 tsc가 알려줌 — 클린 유지).

- [ ] **Step 2: tsc + 기존 테스트 그린 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 오류 0, 기존 vitest 전부 PASS.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/DoodleSvg.tsx
git commit -m "feat(mobile): SVG 두들 프리미티브 WobbleBox·MatchGauge·DoodleFace·DoodleChip"
```

---

### Task 3: 기존 Doodle.tsx 내부를 WobbleBox로 교체 (API 불변 → 전 화면 자동 두들화)

**Files:**
- Modify: `apps/mobile/src/components/Doodle.tsx`

**Interfaces:**
- Consumes: Task 2 `WobbleBox`.
- Produces: `ShadowBox`/`DoodleButton`/`DoodleCard`/`doodleInputStyle` — **시그니처·prop 전부 기존 그대로.** (`ShadowBox`에 optional `seed?: number` prop 추가만 허용.)

- [ ] **Step 1: 교체 구현**

`ShadowBox`: 직선 border+translated 잉크 View 구조를 `WobbleBox(shadow: true)`로 교체:

```tsx
export function ShadowBox({ children, radius, bg = colors.paper, rotate, style, seed = 2 }: {
  children: ReactNode;
  radius: WonkyRadius;
  bg?: string;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
  seed?: number;
}) {
  return (
    <WobbleBox radius={radius} seed={seed} bg={bg} shadow rotate={rotate} style={[styles.shadowOuter, style]}>
      {children}
    </WobbleBox>
  );
}
```

`DoodleButton`: FLAT 유지 — 내부 `View`의 `borderWidth` 제거하고 `WobbleBox`(shadow 없음, `bg` 기존 로직 그대로: disabled→fillDeep, primary→accent, else paper; stroke는 항상 `colors.ink`)로 감싼다. `styles.flatButton`에서 `borderWidth`/`borderColor` 제거.

`DoodleCard`: 변경 불필요 (ShadowBox 경유로 자동 워블).

`doodleInputStyle`: 그대로 둔다 (TextInput 보더까지 SVG화하면 포커스/멀티라인 레이아웃 리스크 — 직선 보더 유지, 삐뚤 radius가 이미 적용됨).

- [ ] **Step 2: 검증**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린. 이어서 웹 스모크: `pnpm --filter @mingle/mobile exec expo export --platform web --output-dir /tmp/doodle-smoke` Expected: 번들 성공.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/Doodle.tsx
git commit -m "feat(mobile): Doodle 프리미티브 워블 보더 전환 (API 불변, 전 화면 자동 적용)"
```

---

### Task 4: 두들 탭바

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/components/DoodleTabBar.tsx`

**Interfaces:**
- Consumes: Task 2 `WobbleBox`. `@react-navigation/bottom-tabs`의 `BottomTabBarProps` (expo-router Tabs가 전달).
- Produces: `DoodleTabBar(props: BottomTabBarProps)` — `<Tabs tabBar={(p) => <DoodleTabBar {...p} />}>`로 연결.

- [ ] **Step 1: 구현**

와이어프레임 패턴: 화면 하단에서 12px 띄운 **플로팅 워블 바** (radius `19/22/18/21`), `shadow` 세로 오프셋(잉크), 탭 5개 유지(홈·채팅·프로포즈·알림·설정). 활성 = `colors.accent` 아이콘+Gaegu 라벨(CLAUDE.md 포인트 컬러 규칙), 비활성 = `colors.grayMid`. 라벨 폰트 `fonts.display` 11px.

```tsx
// apps/mobile/src/components/DoodleTabBar.tsx
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WobbleBox } from "./DoodleSvg";
import { colors, fonts } from "../lib/theme";

const BAR_RADIUS = {
  borderTopLeftRadius: 19,
  borderTopRightRadius: 22,
  borderBottomRightRadius: 18,
  borderBottomLeftRadius: 21,
};

export function DoodleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <WobbleBox radius={BAR_RADIUS} seed={11} shadow strokeWidth={2.4} contentStyle={styles.row}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.grayMid;
          const label = typeof options.title === "string" ? options.title : route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 23 }) : null}
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </WobbleBox>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, bottom: 0, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", height: 60 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontFamily: fonts.display, fontSize: 11 },
});
```

`_layout.tsx`: `screenOptions`의 `tabBarStyle`/`tabBarLabelStyle`/tint 3종 제거, `tabBar={(p) => <DoodleTabBar {...p} />}` 추가. 각 탭 화면 콘텐츠가 플로팅 바에 가리지 않게 각 탭 화면 루트에 `paddingBottom` 관성이 없으므로 — 5개 탭 화면(home/chats/proposals/notifications/settings)의 스크롤/루트 컨테이너에 `paddingBottom: 84` 추가 (이 태스크에서 일괄).

- [ ] **Step 2: 검증**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/app/\(app\)/\(tabs\)/_layout.tsx apps/mobile/src/components/DoodleTabBar.tsx apps/mobile/app/\(app\)/\(tabs\)/*.tsx
git commit -m "feat(mobile): 플로팅 워블 두들 탭바"
```

---

### Task 5: 진입·인증 화면 히어로 (register / login / onboarding)

**Files:**
- Modify: `apps/mobile/app/register.tsx`, `apps/mobile/app/login.tsx`, `apps/mobile/app/onboarding.tsx`
- Create: `apps/mobile/src/components/DoodleHero.tsx`

**Interfaces:**
- Consumes: Task 2 `DoodleFace`, `WobbleBox`.
- Produces: `DoodleHero({ tagline?: string })` — 와이어프레임 ①: 워드마크(`MingleAI` Gaegu 46, `AI`는 accent 컬러 28px) + 태그라인(기본 "낯가림도 괜찮아요") + 두들 얼굴 2개(하나 inverted) + 점선 스프링 커넥터 SVG.

- [ ] **Step 1: DoodleHero 구현**

```tsx
// apps/mobile/src/components/DoodleHero.tsx
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { DoodleFace } from "./DoodleSvg";
import { colors, fonts } from "../lib/theme";

export function DoodleHero({ tagline = "낯가림도 괜찮아요" }: { tagline?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.mark}>
        Mingle<Text style={styles.markAi}>AI</Text>
      </Text>
      <Text style={styles.tagline}>{tagline}</Text>
      <View style={styles.faces}>
        <DoodleFace size={60} seed={4} />
        <Svg width={52} height={38} viewBox="0 0 56 40">
          <Path
            d="M4 20 C14 8 22 32 30 20 C36 11 44 11 50 20"
            fill="none"
            stroke={colors.ink}
            strokeWidth={2.2}
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
          <Path d="M50 20 C46 14 40 15 41 21 C42 26 49 26 50 20 Z" fill={colors.ink} />
        </Svg>
        <DoodleFace size={60} seed={8} inverted />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  mark: { fontFamily: fonts.display, fontSize: 46, color: colors.ink, lineHeight: 52 },
  markAi: { color: colors.accent, fontSize: 28 },
  tagline: { fontFamily: fonts.displayRegular, fontSize: 18, color: colors.grayDark },
  faces: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
});
```

- [ ] **Step 2: 3개 화면에 적용**

각 화면의 기존 타이틀 블록(앱 이름/부제 Text)을 `<DoodleHero />`로 교체(문구 prop으로 유지 — register "낯가림도 괜찮아요", login "다시 만나서 반가워요", onboarding은 기존 안내 카피 유지). CTA 배치는 와이어프레임 ①: primary(fill) 위 / secondary(ghost) 아래 순. 기존 폼 필드·로직·라우팅은 손대지 않는다. 각 파일을 먼저 읽고 타이틀 블록만 치환.

- [ ] **Step 3: 검증 + 커밋**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린.

```bash
git add apps/mobile/app/register.tsx apps/mobile/app/login.tsx apps/mobile/app/onboarding.tsx apps/mobile/src/components/DoodleHero.tsx
git commit -m "feat(mobile): 진입·인증 화면 두들 히어로 (워드마크+두들 얼굴+커넥터)"
```

---

### Task 6: home.tsx 리디자인 (Phase 5c 이연분)

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`

**Interfaces:**
- Consumes: Task 2 `DoodleChip`/`DoodleFace`, Task 1–3 프리미티브, client-core `getMyProfile`(기존, Phase 2).
- Produces: 없음 (리프 화면).

- [ ] **Step 1: 와이어프레임 ② 구조로 재구성**

구성(위→아래), 기존 notice 카드·매칭 시작 로직(navigatingRef 가드 포함)은 그대로 보존:

1. **앱바 인사**: `안녕하세요 👋` (tiny muted) + `{이름}님, 오늘 나가볼까요?` (Gaegu 24). 이름은 `getMyProfile()`을 `useEffect`에서 호출해 `profile.name`; 실패/로딩 시 이름 없이 `오늘 나가볼까요?`. import는 화면 내 기존 client-core 사용 패턴을 따른다 (다른 화면의 `getMyProfile` import 경로 참조).
2. **반전 잉크 히어로 카드** (`ShadowBox` bg `colors.ink`, rotate "-0.6deg"): `⚡ AI 매칭` Gaegu 19 흰 글자 + 설명 "취향을 분석해 잘 맞는 사람들과 파티를 만들어줘요." (13.5px, 흰 85% 불투명) + 그 안에 `매칭 시작` primary DoodleButton (accent — 화면 내 유일 포인트).
3. **바로가기 행 2개** (DoodleCard, dashed 상단 구분 없이 카드 2장): `💬 채팅` → `router.push("/chats")`, `🤝 프로포즈` → `router.push("/proposals")` — 각각 Gaegu 17 타이틀 + 12.5px 설명 + chevron(Lucide `ChevronRight`).
4. 하단 힌트 문구 유지.

ScrollView 루트 (`paddingBottom: 84` — Task 4 규칙).

- [ ] **Step 2: 검증 + 커밋**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린.

```bash
git add "apps/mobile/app/(app)/(tabs)/home.tsx"
git commit -m "feat(mobile): 홈 두들 리디자인 — 인사 앱바·반전 AI 매칭 히어로·바로가기 카드"
```

---

### Task 7: 리스트 화면 패스 (chats / proposals / notifications)

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/chats.tsx`, `apps/mobile/app/(app)/(tabs)/proposals.tsx`, `apps/mobile/app/(app)/(tabs)/notifications.tsx`

**Interfaces:**
- Consumes: Task 2 `DoodleChip`/`DoodleFace`, 기존 `DoodleAvatar`.
- Produces: 없음.

- [ ] **Step 1: 공통 패턴 적용 (각 파일 읽고 스타일만 치환 — 데이터/로직/소켓 불변)**

- **앱바**: 각 탭 상단에 Gaegu 26 타이틀 (`채팅`/`프로포즈`/`알림`) — 와이어프레임 `htitle` 패턴.
- **행 구분선**: 리스트 행 사이 `borderTopWidth: 1.6, borderStyle: "dashed", borderTopColor: colors.grayLight` (와이어프레임 `.row + .row`).
- **안읽음/미확인 배지**: 잉크 원형(20px, `borderRadius: 10`) + 흰 숫자 — chats의 안읽음 수, notifications의 미확인 dot에 적용. 안읽음 존재 행은 배지만 `colors.accent` 배경 허용(포인트 컬러 규칙: 안읽음 배지).
- **빈 상태**: 각 화면 빈 상태에 `DoodleFace variant="flat"` 64px + 기존 문구 (EmptyState 컴포넌트가 있으면 그것을 수정).
- 행 타이틀 `fonts.display` 17px, 서브텍스트 12.5px `colors.grayMid` — 이미 그런 화면은 그대로.

- [ ] **Step 2: 검증 + 커밋**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린.

```bash
git add "apps/mobile/app/(app)/(tabs)/chats.tsx" "apps/mobile/app/(app)/(tabs)/proposals.tsx" "apps/mobile/app/(app)/(tabs)/notifications.tsx"
git commit -m "feat(mobile): 채팅·프로포즈·알림 두들 리스트 패스 (dashed 행·반전 배지·두들 빈상태)"
```

---

### Task 8: 설정·상세 화면 크롬 패스 (settings / blocks / report / date-plan / matching / chat / party 크롬)

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/settings.tsx`, `apps/mobile/app/(app)/blocks.tsx`, `apps/mobile/app/(app)/report/[profileId].tsx`, `apps/mobile/app/(app)/date-plan/[matchId].tsx`, `apps/mobile/app/(app)/matching.tsx`, `apps/mobile/app/(app)/chat/[roomId].tsx`, `apps/mobile/app/(app)/party/[id].tsx`

**Interfaces:**
- Consumes: Task 2 전 프리미티브.
- Produces: 없음.

- [ ] **Step 1: 화면별 적용 (로직·소켓·게임 UI 불변, 각 파일 먼저 읽기)**

- **settings**: 와이어프레임 ⑥ — 상단 중앙 `DoodleAvatar` 92px + 이름 Gaegu 26 + 위치/직업 muted. 그 아래 설정 행들(`row` 패턴: Lucide 아이콘 + Gaegu 17 라벨 + chevron, dashed 구분). 차단 목록·로그아웃 행 유지.
- **blocks / report / date-plan / matching**: 카드·버튼은 Task 3으로 이미 워블화 — 여기선 타이틀을 Gaegu `htitle` 패턴으로, 선택지·상태 표시를 `DoodleChip`(on/off)으로 교체. matching 대기 화면에 `DoodleFace variant="open"` + 점 애니메이션 유지.
- **chat/[roomId]**: 말풍선 보더를 `doodle.radius.card` 삐뚤 radius로 (직선 유지 OK, SVG 불필요 — 성능), 내 말풍선 = `colors.fillDeep`, 상대 = paper + 잉크 보더. 헤더는 기존 BackButton 패턴 유지.
- **party/[id]**: 바깥 크롬만 — 섹션 타이틀 Gaegu, 채팅 입력/버튼은 이미 프리미티브. `PartyRoomCanvas`·`among/*`·밸런스 게임 카드 내부 **절대 불변**.

- [ ] **Step 2: 검증 + 커밋**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: 클린.

```bash
git add "apps/mobile/app/(app)/(tabs)/settings.tsx" "apps/mobile/app/(app)/blocks.tsx" "apps/mobile/app/(app)/report/[profileId].tsx" "apps/mobile/app/(app)/date-plan/[matchId].tsx" "apps/mobile/app/(app)/matching.tsx" "apps/mobile/app/(app)/chat/[roomId].tsx" "apps/mobile/app/(app)/party/[id].tsx"
git commit -m "feat(mobile): 설정·상세 화면 두들 크롬 패스"
```

---

### Task 9: 번들 스모크 + 문서 갱신 + 마무리

**Files:**
- Modify: `CLAUDE.md`(워크트리 루트), `docs/design/DESIGN.md`

**Interfaces:** 없음.

- [ ] **Step 1: 전체 검증**

```bash
pnpm --filter @mingle/mobile exec tsc --noEmit
pnpm --filter @mingle/mobile test
pnpm --filter @mingle/client-core test
pnpm --filter @mingle/mobile exec expo export --platform ios --output-dir /tmp/doodle-ios-smoke
pnpm --filter @mingle/mobile exec expo export --platform android --output-dir /tmp/doodle-android-smoke
```
Expected: 전부 성공 (모듈 수 출력 확인).

- [ ] **Step 2: 문서 갱신**

- `CLAUDE.md`: 디자인 섹션의 "⚠️ worktree-doodle-style-tile에만 미커밋 존재" 문구를 `docs/design/`로 정정; 프리미티브 목록에 `DoodleSvg.tsx`(WobbleBox/MatchGauge/DoodleFace/DoodleChip)·`DoodleTabBar`·`DoodleHero`·`doodle-path.ts` 추가; "feTurbulence 금지 — 시드 지터 패스 사용" 가이드 명시.
- `docs/design/DESIGN.md` §6 로드맵: "와이어프레임 → 실제 RN 컴포넌트 구현" 체크 처리 + 구현 위치 명기.

- [ ] **Step 3: 커밋**

```bash
git add CLAUDE.md docs/design/DESIGN.md
git commit -m "docs: 두들 와이어프레임 모바일 이식 완료 반영 (CLAUDE.md·DESIGN.md)"
```
