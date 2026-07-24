# 라인아트 재설계 + 화면 아키타입 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기능 유지한 채 (1) 비주얼을 소프트로즈 → 얇은 선 라인아트로 교체하고, (2) 전 화면을 공통 `AppScreen` 골격 + 6개 아키타입으로 통일한다.

**Architecture:** 스킨(토큰·프리미티브)과 골격(AppScreen)은 직교. 순서는 토큰 → 프리미티브 → 골격 → 화면 리팩터 → 문서. 토큰은 기존 이름 유지·값만 remap(consumer ~48개 무변경) + 신규 `accentStrong`/`line`/`outline` 추가. 골격은 `Foundation.tsx`의 기존 `PageHeader`/`StateView`/`ContentColumn`을 `AppScreen` 한 래퍼로 흡수.

**Tech Stack:** React Native + Expo Router, TypeScript strict, Pretendard(로컬), lucide-react-native, reanimated, Vitest(모바일 순수 lib 전용).

## Global Constraints

- 액센트 `accent`=`#FF4D3D`는 흰글씨 위 3.29:1 = **AA 실패**. 흰글씨 얹는 서피스는 무조건 `accentStrong`=`#D6361F`(4.77:1). 밝은 코랄은 선/아이콘/활성/틴트만.
- `danger`=`#C4122F`(쿨 크림슨) — 웜 코랄과 색상 분리, 파괴적 확인 최종에만.
- 타이포 Pretendard 단일. 하드코딩 fontFamily 금지, `type.*`/`fonts.*` 토큰만. Cafe24Dongdong 전면 제거.
- elevation = 외곽선 우선, 그림자 최소(모달·시트·hero만 소프트 그림자).
- 라운드: card 18 · button 14 · input 14 · chip 999 · sheet 20.
- 탭 IA 유지(홈·채팅·네이버예약·설정). 신규 기능·백엔드 변경 없음.
- Prettier: double quotes, trailingComma all, printWidth 100, 세미콜론. Korean copy OK.
- 각 페이즈 후: `pnpm --filter @mingle/mobile exec tsc --noEmit` clean + `pnpm --filter @mingle/mobile test` green.

---

## Phase 0 — 토큰 (theme.ts 라인아트 교체)

### Task 0.1: 팔레트·타이포 토큰 remap + accentStrong/line/outline 추가

**Files:**
- Modify: `apps/mobile/src/lib/theme.ts`
- Test: `apps/mobile/src/lib/__tests__/theme.test.ts` (신규)

**Interfaces:**
- Produces: `colors.accent`(#FF4D3D), `colors.accentStrong`(#D6361F), `colors.accentPressed`(#B92E1A), `colors.accentFill`(#FFE7E3), `colors.line`(#E8E5E0), `colors.outline`(#E0DBD3), `colors.danger`(#C4122F). 기존 이름(`ink/paper/card/border/grayLight/grayDark/grayMid/fill/fillDeep/heading/onAccent/success/warning`) 전부 존속(값만 이동).

- [ ] **Step 1: 대비 불변식 가드 테스트 작성 (실패 예상)**

`apps/mobile/src/lib/__tests__/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { colors } from "../theme";

// WCAG relative luminance + contrast (순수 계산).
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe("line-art token invariants", () => {
  it("accentStrong carries white text at AA (>=4.5)", () => {
    expect(contrast(colors.accentStrong, colors.onAccent)).toBeGreaterThanOrEqual(4.5);
  });
  it("grayMid is AA on both paper and card (>=4.5)", () => {
    expect(contrast(colors.grayMid, colors.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.grayMid, colors.card)).toBeGreaterThanOrEqual(4.5);
  });
  it("ink is strong on paper (>=12)", () => {
    expect(contrast(colors.ink, colors.paper)).toBeGreaterThanOrEqual(12);
  });
  it("danger hue is separated from accent (not the same red)", () => {
    expect(colors.danger).not.toBe(colors.accent);
    expect(colors.danger).not.toBe(colors.accentStrong);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- theme`
Expected: FAIL (accentStrong 등 미정의 / 현 로즈 값이 불변식 불충족).

- [ ] **Step 3: theme.ts `colors` 블록 교체**

`apps/mobile/src/lib/theme.ts`의 `export const colors = {...}` 를 아래로 교체(주석 갱신):

```ts
export const colors = {
  ink: "#181514", // 먹선·본문 (따뜻 니어블랙)
  paper: "#FBFAF8", // 페이지 그라운드 (살짝 웜 오프화이트)
  card: "#FFFFFF", // 카드 서피스
  heading: "#181514", // 라인아트 = 타이틀도 잉크 (색 강조는 코랄 1점만)
  grayDark: "#57534E", // 보조 텍스트 (AA)
  grayMid: "#78716C", // 캡션·비활성 (white/paper 위 AA)
  grayLight: "#E8E5E0", // = line 별칭 값 (divider)
  line: "#E8E5E0", // 헤어라인 divider·행 구분
  border: "#E0DBD3", // = outline 값 (카드·인풋 외곽; 이름 유지)
  outline: "#E0DBD3", // 카드·인풋 외곽선 (신규 별칭)
  fill: "#F4F2EF", // 중립 연회색 fill (disabled·notice bg)
  fillDeep: "#ECE9E4",
  partyFloor: "#E9E2D6", // (파티 게임 비활성 — 레거시 값 유지)
  partyRoom: "#FFFDF8",
  partyRoomWarm: "#F8F0E6",
  partyRoomRose: "#F8ECEC",
  accent: "#FF4D3D", // 브랜드 코랄 — 선·아이콘·활성탭·틴트 전용 (흰글씨 X)
  accentBright: "#FF6F5E", // 밝은 코랄 (일러스트·표현)
  accentDeep: "#B92E1A", // pressed (레거시 이름 유지)
  accentPressed: "#B92E1A", // 눌림 (신규 별칭)
  accentSoft: "#FF6F5E",
  accentStrong: "#D6361F", // 흰글씨 얹는 코랄 fill (버튼·배지) — white 4.77:1 AA
  accentFill: "#FFE7E3", // 연코랄 틴트 (hero 배경·pressed)
  onAccent: "#FFFFFF",
  success: "#257A55",
  warning: "#9A5D00",
  warningFill: "#FFF0D6",
  danger: "#C4122F", // 쿨 크림슨 — 웜 코랄과 색상 분리
  dangerFill: "#FCE8EC",
} as const;
```

- [ ] **Step 4: `type` 디스플레이 폰트 Pretendard 단일화**

`type.display`·`type.title`의 `fontFamily: "Cafe24Dongdong_400Regular"` → `"Pretendard_600SemiBold"`. `heading/body/label/caption`은 그대로. 주석의 "Cafe24 Dongdong" 언급 제거.

```ts
export const type = {
  display: { fontFamily: "Pretendard_600SemiBold", fontSize: 28, lineHeight: 36 },
  title: { fontFamily: "Pretendard_600SemiBold", fontSize: 22, lineHeight: 29 },
  heading: { fontFamily: "Pretendard_600SemiBold", fontSize: 19, lineHeight: 25 },
  body: { fontFamily: "Pretendard_400Regular", fontSize: 16, lineHeight: 24 },
  label: { fontFamily: "Pretendard_600SemiBold", fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: "Pretendard_400Regular", fontSize: 13, lineHeight: 18 },
} as const;
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @mingle/mobile test -- theme`
Expected: PASS (4 tests).

- [ ] **Step 6: 커밋**

```bash
git add apps/mobile/src/lib/theme.ts apps/mobile/src/lib/__tests__/theme.test.ts
git commit -m "feat(mobile): 라인아트 팔레트·타이포 토큰 + 대비 가드 테스트"
```

### Task 0.2: Cafe24Dongdong 폰트 로드 제거

**Files:**
- Modify: `apps/mobile/app/_layout.tsx:15-21`

- [ ] **Step 1: useFonts에서 Dongdong 2줄 제거**

`apps/mobile/app/_layout.tsx`의 `useFonts({...})`에서 `Cafe24Dongdong_400Regular`·`Cafe24Dongdong_300Light` 항목 삭제. Pretendard 2종만 남김. 주석 "Cafe24 Dongdong (OFL)..." 줄 삭제.

- [ ] **Step 2: 잔존 참조 없음 확인**

Run: `grep -rn "Cafe24Dongdong\|Dongdong" apps/mobile/src apps/mobile/app`
Expected: 결과 없음(0줄). 있으면 해당 파일에서 `type.*`/`fonts.*` 토큰으로 교체.

- [ ] **Step 3: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 4: 커밋**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "chore(mobile): Cafe24Dongdong 폰트 로드 제거 (Pretendard 단일)"
```

---

## Phase 1 — 프리미티브 라인아트 룩

### Task 1.1: DoodleButton primary/danger를 accentStrong·크림슨으로

**Files:**
- Modify: `apps/mobile/src/components/Doodle.tsx:82-97,193`

**Interfaces:**
- Consumes: `colors.accentStrong`, `colors.accentDeep`, `colors.danger` (Task 0.1).

- [ ] **Step 1: 버튼 bg/stroke를 AA 안전값으로 교체**

`Doodle.tsx` `DoodleButton` 내부 `bg`/`stroke` 계산을 교체 — primary 채움은 `accentStrong`(흰글씨 AA), 외곽선은 밝은 코랄이 아닌 동일 `accentStrong`:

```tsx
  const bg = off
    ? colors.fill
    : dangerSolid
      ? colors.danger
      : primary
        ? colors.accentStrong
        : colors.card;
  const fg = off
    ? colors.grayMid
    : danger
      ? colors.danger
      : primary || dangerSolid
        ? colors.onAccent
        : colors.ink;
  const stroke = danger || dangerSolid ? colors.danger : primary ? colors.accentStrong : colors.border;
```

- [ ] **Step 2: 버튼 라벨 폰트를 clean 산세리프로**

`styles.btnText`의 `fontFamily: fonts.display`는 이미 Pretendard SemiBold이므로 값 변경 불필요. `letterSpacing: 0.3` → `0` (라인아트 클린), `fontSize: 18` → `16`, `lineHeight: 23` → `21` 로 조정:

```tsx
  btnText: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 21, letterSpacing: 0 },
```

- [ ] **Step 3: 헤더 주석 갱신**

`Doodle.tsx` 상단 파일 주석의 "hand-drawn sticker"/WobbleBox 지터 설명을 라인아트 설명으로 교체(1-8행): "라인아트 프리미티브 — 화이트 서피스 + 얇은 outline, 그림자 최소. primary는 accentStrong 채움+흰글씨(AA), secondary는 화이트+outline."

- [ ] **Step 4: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 5: 커밋**

```bash
git add apps/mobile/src/components/Doodle.tsx
git commit -m "feat(mobile): DoodleButton 라인아트 — primary accentStrong 채움(흰글씨 AA)"
```

### Task 1.2: WobbleBox 그림자 기본 off 확인 + DoodleChip/DashedLine 색 정합

**Files:**
- Modify: `apps/mobile/src/components/DoodleSvg.tsx:156-177,179-221`

- [ ] **Step 1: DoodleChip on 상태 accentStrong로 (흰글씨)**

`DoodleChip`의 on일 때 `bg`가 `colors.accent`(흰글씨 AA실패) → 흰글씨 얹으므로 `colors.accentStrong`로. stroke도 `accentStrong`:

```tsx
    <WobbleBox
      radius={doodle.radius.chip}
      bg={on ? colors.accentStrong : colors.card}
      stroke={on ? colors.accentStrong : colors.border}
      strokeWidth={1.5}
```

- [ ] **Step 2: DashedLine 기본색을 line 토큰으로**

`DashedLine`의 기본 `color = colors.grayLight`는 값이 `#E8E5E0`(=line)이라 그대로 유효. 변경 없음(확인만).

- [ ] **Step 3: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 4: 커밋**

```bash
git add apps/mobile/src/components/DoodleSvg.tsx
git commit -m "feat(mobile): DoodleChip on 상태 accentStrong (흰글씨 AA)"
```

### Task 1.3: DoodleFace 라인 버전 (빈상태 두들 감성 유지)

**Files:**
- Modify: `apps/mobile/src/components/DoodleSvg.tsx:106-153`

- [ ] **Step 1: 얼굴 stroke/색을 라인아트로**

`DoodleFace`에서 채움 원(`face`) 대신 **투명 채움 + ink 얇은 선**으로. `stroke={colors.heading}`(이제 ink) `strokeWidth={2.6}` → `stroke={colors.ink}` `strokeWidth={1.8}`. 이목구비도 `feat`를 `colors.ink`로, 눈 `r={2.8}`→`r={2.2}`. inverted(내 이름표 등)일 때만 `colors.accentStrong` 채움 + 흰 이목구비 유지:

```tsx
  const face = inverted ? colors.accentStrong : "transparent";
  const feat = inverted ? colors.onAccent : colors.ink;
  const ring = inverted ? colors.accentStrong : colors.ink;
  // ...
  <Path d={circleD} fill={face} stroke={ring} strokeWidth={1.8} />
  <Circle cx={R - 9} cy={R - 5} r={2.2} fill={feat} />
  <Circle cx={R + 9} cy={R - 5} r={2.2} fill={feat} />
  <Path d={mouth} fill={variant === "open" ? feat : "none"} stroke={feat} strokeWidth={1.8} strokeLinecap="round" />
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/DoodleSvg.tsx
git commit -m "feat(mobile): DoodleFace 얇은 라인 버전 (빈상태 두들 감성)"
```

### Task 1.4: DoodleTabBar activeDot·badge를 accentStrong로 정합

**Files:**
- Modify: `apps/mobile/src/components/DoodleTabBar.tsx:31,87-107`

- [ ] **Step 1: 활성 아이콘은 밝은 accent 유지, 흰글씨 badge는 accentStrong**

`color = focused ? colors.accent : colors.grayMid` 유지(아이콘 = 선, 흰글씨 아님 → 밝은 코랄 OK). `styles.badge`의 `backgroundColor: colors.accent` → `colors.accentStrong`(흰글씨 배지). `activeDot`은 `colors.accent` 유지. `bar`의 로즈브라운 그림자 색 `#7A2A3A` → `#2A2320`(라인아트 중립 그림자):

```tsx
  badge: { /* ... */ backgroundColor: colors.accentStrong, /* ... */ },
```
```tsx
  bar: { /* ... */ shadowColor: "#2A2320", shadowOpacity: 0.06, /* ... */ },
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/DoodleTabBar.tsx
git commit -m "feat(mobile): 탭바 badge accentStrong·중립 그림자 (라인아트)"
```

### Task 1.5: shadow 토큰 중립화 + doodle.shadow 폐기 주석

**Files:**
- Modify: `apps/mobile/src/lib/theme.ts` (shadow 블록)

- [ ] **Step 1: 소프트 그림자 색을 중립 웜그레이로**

`shadow.card`·`shadow.elevated`의 `shadowColor: "#7A2A3A"`(로즈브라운) → `"#2A2320"`(라인아트 중립). opacity/radius/offset 유지. `shadow.card`는 라인아트에서 카드에 거의 안 쓰이고 시트/hero용이므로 값 유지.

```ts
export const shadow = {
  card: { shadowColor: "#2A2320", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  elevated: { shadowColor: "#2A2320", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
} as const;
```

- [ ] **Step 2: tsc + 전체 모바일 테스트**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: `Found 0 errors`; 테스트 green(127+4).

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/lib/theme.ts
git commit -m "feat(mobile): 소프트 그림자 중립 웜그레이 (라인아트 elevation)"
```

---

## Phase 2 — 공통 골격 AppScreen + ListRow

### Task 2.1: AppScreen 래퍼 컴포넌트

**Files:**
- Create: `apps/mobile/src/components/AppScreen.tsx`

**Interfaces:**
- Consumes: `PageHeader`(Foundation.tsx), `ContentColumn`(Foundation.tsx), `useTabBarClearance`(DoodleTabBar.tsx), `colors`/`layout`/`space`(theme).
- Produces: `AppScreen` 컴포넌트. Props: `header?: { title: string; description?: string; back?: boolean; action?: ReactNode }`, `body?: "scroll" | "plain"`(기본 "scroll"), `footer?: ReactNode`, `scrollRef?`, `contentStyle?`, `tabScreen?: boolean`(true면 탭 클리어런스 하단 패딩), `children`.

- [ ] **Step 1: AppScreen 작성**

`apps/mobile/src/components/AppScreen.tsx`:

```tsx
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, space } from "../lib/theme";
import { ContentColumn, PageHeader } from "./Foundation";
import { useTabBarClearance } from "./DoodleTabBar";

type HeaderProps = { title: string; description?: string; back?: boolean; action?: ReactNode };

/**
 * 유일한 화면 래퍼 — SafeArea·paper 배경·헤더존·폭 캡·탭 클리어런스·하단 고정 footer를 흡수한다.
 * 화면 파일은 콘텐츠만 넣는다(자체 SafeArea/헤더/컨테이너 배선 금지). Immersive(스피드데이트 세션·
 * 파티 월드)만 이 래퍼 밖에서 자체 크롬을 가진다.
 */
export function AppScreen({
  header,
  body = "scroll",
  footer,
  tabScreen = false,
  contentStyle,
  children,
}: {
  header?: HeaderProps;
  body?: "scroll" | "plain";
  footer?: ReactNode;
  tabScreen?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const clearance = useTabBarClearance();
  const bottomPad = (tabScreen ? clearance : insets.bottom) + (footer ? 0 : space.x4);

  const head = header ? (
    <ContentColumn style={styles.gutter}>
      <PageHeader
        title={header.title}
        description={header.description}
        back={header.back}
        action={header.action}
      />
    </ContentColumn>
  ) : null;

  const inner =
    body === "scroll" ? (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {head}
        <ContentColumn style={styles.gutter}>{children}</ContentColumn>
      </ScrollView>
    ) : (
      <View style={[styles.flex, { paddingBottom: bottomPad }]}>
        {head}
        <ContentColumn style={[styles.gutter, styles.flex]}>{children}</ContentColumn>
      </View>
    );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {inner}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.x3 }]}>
          <ContentColumn style={styles.gutter}>{footer}</ContentColumn>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  gutter: { paddingHorizontal: layout.screenGutter },
  footer: {
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 0,
    paddingTop: space.x3,
  },
});
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/AppScreen.tsx
git commit -m "feat(mobile): AppScreen 공통 골격 래퍼 (헤더·폭·클리어런스·footer 흡수)"
```

### Task 2.2: ListRow + Separator 공용 행 컴포넌트

**Files:**
- Create: `apps/mobile/src/components/ListRow.tsx`

**Interfaces:**
- Produces: `ListRow` (props: `leading?: ReactNode`, `title: string`, `subtitle?: string`, `trailing?: ReactNode`, `onPress?: () => void`, `accessibilityLabel?: string`), `RowSeparator` (헤어라인).

- [ ] **Step 1: ListRow 작성**

`apps/mobile/src/components/ListRow.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors, control, layout, space, type } from "../lib/theme";

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight color={colors.grayMid} size={20} strokeWidth={1.75} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
    >
      {body}
    </Pressable>
  );
}

export function RowSeparator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.x3,
    minHeight: 60,
    paddingVertical: space.x3,
    paddingHorizontal: layout.screenGutter,
  },
  leading: { width: control.minTouch, alignItems: "center" },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.body, color: colors.ink },
  subtitle: { ...type.caption, color: colors.grayMid, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: layout.screenGutter },
});
```

- [ ] **Step 2: tsc 확인**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 3: 커밋**

```bash
git add apps/mobile/src/components/ListRow.tsx
git commit -m "feat(mobile): ListRow·RowSeparator 공용 행 컴포넌트"
```

---

## Phase 3 — 화면 아키타입 리팩터

**공통 리팩터 레시피(모든 화면에 적용):**
1. 화면 최상위 컨테이너(자체 `View`/`ScrollView`/SafeArea/헤더/`useTabBarClearance`)를 `<AppScreen>`로 교체.
2. 탭 화면은 `tabScreen`, 상세는 `header={{ back:true, title }}`.
3. 리스트는 `body="scroll"` + `ListRow`/`RowSeparator`(또는 FlatList를 children로), 빈/로딩/에러는 `StateView`.
4. Detail/Flow의 주요 버튼은 `footer={<DoodleButton variant="primary" ... />}`.
5. 화면당 primary 1개, 자체 헤더·일회성 컨테이너 제거.
6. 각 화면 리팩터 후 tsc clean, 커밋.

> 각 태스크는 위 레시피 + 아래 화면별 구체값. 리팩터는 기능·데이터 로직 무변경, **레이아웃 배선만** 교체.

### Task 3.1: List 화면군 (6개)

**Files (각각 Modify):**
- `apps/mobile/app/(app)/(tabs)/chats.tsx` — `tabScreen`, header `{title:"채팅"}`, FlatList children, 빈=StateView("아직 열린 대화가 없어요"), 행=ListRow(avatar leading, 이름 title, 마지막메시지 subtitle, 안읽음 배지 trailing).
- `apps/mobile/app/(app)/(tabs)/proposals.tsx` — header `{back:true,title:"프로포즈"}`(탭바 숨김 라우트), 받은/보낸 세그먼트는 children 상단, 행=ListRow.
- `apps/mobile/app/(app)/(tabs)/notifications.tsx` — header `{back:true,title:"알림"}`, 행=ListRow, Switch trackColor 웹 교정 유지.
- `apps/mobile/app/(app)/(tabs)/settings.tsx` — `tabScreen`, header `{title:"설정"}`, 설정 항목=ListRow + RowSeparator, 위험 항목(차단·계정삭제) trailing chevron.
- `apps/mobile/app/(app)/blocks.tsx` — header `{back:true,title:"차단 관리"}`, 행=ListRow(해제 버튼 trailing), 빈=StateView.
- `apps/mobile/app/(app)/(tabs)/naver-reserve.tsx` — `tabScreen`, header `{title:"근처 맛집"}`, 지도 컴포넌트는 children 상단 고정 + 리스트 ListRow(네이버 링크 trailing).

- [ ] **Step 1: chats.tsx 리팩터** — 레시피 적용. 기존 `getMatches` 로직·`EnterRow` 유지. `styles.container`/`headerColumn`/수동 clearance 제거.
- [ ] **Step 2: tsc + 커밋** (`refactor(mobile): 채팅 목록 AppScreen/ListRow 아키타입`)
- [ ] **Step 3: proposals.tsx 리팩터 → tsc → 커밋**
- [ ] **Step 4: notifications.tsx 리팩터 → tsc → 커밋**
- [ ] **Step 5: settings.tsx 리팩터 → tsc → 커밋**
- [ ] **Step 6: blocks.tsx 리팩터 → tsc → 커밋**
- [ ] **Step 7: naver-reserve.tsx 리팩터 → tsc → 커밋**

각 커밋 후 Run: `pnpm --filter @mingle/mobile exec tsc --noEmit` → `Found 0 errors`.

### Task 3.2: Detail 화면군 (3개)

**Files (각각 Modify):**
- `apps/mobile/app/(app)/chat/[roomId].tsx` — header `{back:true,title:상대이름}`, 메시지 리스트 children, 입력바는 footer(고정). 채팅 버블: 내=accentStrong+onAccent, 상대=card+outline.
- `apps/mobile/app/(app)/date-plan/[matchId].tsx` — header `{back:true,title:"데이트 플랜"}`, 정보 카드 children, footer=주 액션(작성자 "선택"/상대 "확정") 멱등.
- `apps/mobile/app/(app)/terms.tsx` + `privacy.tsx` — header `{back:true,title}`, 본문 문서 children, footer 없음.

- [ ] **Step 1: chat/[roomId].tsx 리팩터 → tsc → 커밋**
- [ ] **Step 2: date-plan/[matchId].tsx 리팩터 → tsc → 커밋**
- [ ] **Step 3: terms.tsx + privacy.tsx 리팩터 → tsc → 커밋**

### Task 3.3: Flow 화면군 (7개)

**Files (각각 Modify):**
- `apps/mobile/app/login.tsx` — plain body, 브랜딩(DoodleHero) + 소셜 버튼들 footer 아님(중앙), primary 없음(소셜 각각 secondary).
- `apps/mobile/app/consent.tsx` — header `{title:"약관 동의"}`, 동의 항목 children, footer=`동의하고 계속`.
- `apps/mobile/app/permissions.tsx` — header, 권한 설명 children, footer=`권한 허용`.
- `apps/mobile/app/verify-identity.tsx` — header `{title:"본인 인증"}`, 폼 children, footer=`인증`.
- `apps/mobile/app/onboarding.tsx` — header `{title:"프로필"}`, 폼 children, footer=`완료`. (iOS KAV 백로그 유지.)
- `apps/mobile/app/(app)/speed-date/index.tsx` — header `{title:"블라인드 데이트"}`, 반경 칩(DoodleChip)·조건 children, footer=`시작하기`.
- `apps/mobile/app/(app)/report/[profileId].tsx` — header `{back:true,title:"신고"}`, 사유 폼 children, footer=`신고`(danger). `delete-account.tsx`는 Flow(비가역): header `{back:true,title:"계정 삭제"}`, footer=`dangerSolid`+`serious`+`ConfirmDialog`.

- [ ] **Step 1: login.tsx 리팩터 → tsc → 커밋**
- [ ] **Step 2: consent.tsx → tsc → 커밋**
- [ ] **Step 3: permissions.tsx → tsc → 커밋**
- [ ] **Step 4: verify-identity.tsx → tsc → 커밋**
- [ ] **Step 5: onboarding.tsx → tsc → 커밋**
- [ ] **Step 6: speed-date/index.tsx → tsc → 커밋**
- [ ] **Step 7: report/[profileId].tsx + delete-account.tsx → tsc → 커밋**

### Task 3.4: Hub (홈)

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`

- [ ] **Step 1: home.tsx를 AppScreen(tabScreen)로**

자체 `ScrollView`/`container`/수동 clearance 제거 → `<AppScreen tabScreen>`. 인사 헤더는 `header` 대신 children 최상단 커스텀(인사+이름, back 없음). 블라인드 데이트 히어로 `DoodleCard elevated`(accent 외곽 강조). '최근' 허브 카드(프로포즈/알림/게임파티) = `DoodleCard` + `ListRow`(내부 행)·`RowSeparator`. primary는 히어로 1개.

- [ ] **Step 2: tsc + 전체 테스트**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit && pnpm --filter @mingle/mobile test`
Expected: `Found 0 errors`; green.

- [ ] **Step 3: 커밋** (`refactor(mobile): 홈 Hub 아키타입 (AppScreen)`)

### Task 3.5: Immersive 스킨 정합 (2개, 골격 밖)

**Files (각각 Modify):**
- `apps/mobile/app/(app)/speed-date/[id].tsx` — 자체 크롬 유지. 색·버튼만 라인아트 토큰으로(accent/accentStrong/ink). 골격 미적용.
- `apps/mobile/app/(app)/party/[id].tsx` — 비활성(FEATURES.partyGame=false). UI 칩/버튼 토큰 참조만 자동 반영. 픽셀 아트(Kenney)는 무변경.

- [ ] **Step 1: speed-date/[id].tsx 색 토큰 정합 확인** — 하드코딩 색 있으면 토큰으로. Run: `grep -n "#[0-9A-Fa-f]\{6\}" apps/mobile/app/(app)/speed-date/[id].tsx` → 결과를 토큰으로 교체(팔레트 밖 색 없게).
- [ ] **Step 2: tsc → 커밋**

---

## Phase 4 — 문서 갱신

### Task 4.1: CLAUDE.md 디자인 섹션 라인아트로 교체

**Files:**
- Modify: `CLAUDE.md` (Design system 섹션 + Status 요약 + 폰트/프리미티브 gotchas)

- [ ] **Step 1: "Design system — soft romantic (rose)" 섹션을 "line-art (coral)"로 교체** — 팔레트(ink/paper/line/outline/accent/accentStrong/danger), Pretendard 단일, elevation=외곽선 우선, AppScreen 아키타입 시스템(6종) 추가. 소프트로즈 서술 삭제.
- [ ] **Step 2: mobile 레이아웃 줄의 폰트 설명(Pretendard+동동) → Pretendard 단일. 내비 설명에 AppScreen 골격 1줄 추가.**
- [ ] **Step 3: Status 요약에 2026-07-24 라인아트+아키타입 재설계 1줄 추가.**
- [ ] **Step 4: 커밋** (`docs: CLAUDE.md 라인아트+아키타입 시스템 반영`)

### Task 4.2: 메모리 갱신

**Files:**
- Modify: `/Users/namuneulbo/.claude/projects/-Users-namuneulbo-Desktop-MingleAI/memory/doodle-bw-mobile-design.md` + `MEMORY.md` 포인터

- [ ] **Step 1: 디자인 메모리를 라인아트(coral #FF4D3D·Pretendard·AppScreen 아키타입)로 갱신.** 소프트로즈는 superseded로 기록. MEMORY.md 포인터 훅 문구 수정.

---

## Self-Review

**Spec coverage:** 스펙 §1~§10 대응 — 기능맵(§1→Task 없음, 정보), 화면맵(§2→Phase 3 태스크), 아키타입(§3→Task 2.1/2.2 + Phase 3), 토큰(§4→Phase 0), 컴포넌트(§5→Phase 1), 와이어프레임(§6→Phase 3 화면별 구체값), 롤아웃(§7→Phase 0-4 순서), 리스크(§8→Global Constraints·Task 0.1 가드테스트), 논골(§9→범위 제외), 성공기준(§10→각 페이즈 tsc/test 게이트). 갭 없음.

**Placeholder scan:** Phase 3 태스크는 "레시피 + 화면별 구체값"으로 각 화면의 header/body/footer/빈상태를 명시 — "Similar to Task N" 아님(공통 레시피는 1회 정의 후 화면별 구체 파라미터 제시, 반복 코드 회피). 코드가 바뀌는 프리미티브/골격(Phase 0-2)은 전부 실제 코드 포함.

**Type consistency:** `AppScreen` props(header/body/footer/tabScreen), `ListRow` props(leading/title/subtitle/trailing/onPress), `colors.accentStrong`/`line`/`outline` — Phase 0에서 정의, Phase 1-3에서 동일 이름 사용. 정합.
