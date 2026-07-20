# 게임 월드 비주얼 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파티 게임 월드를 귀여운 두들 일러스트 수준으로 끌어올린다 — 매칭 시작부터 가로 전환, 게임 월드 프레임 제거(풀블리드), 치비 2등신 귀여운 캐릭터, 일러스트 가구·환경 소품.

**Architecture:** 순수 렌더 교체 — 충돌·좌표·소켓 로직 무변경. 캐릭터 파츠 선택은 순수 함수(`character-look.ts`, vitest)로 분리, `DoodleCharacter`가 조립. 맵은 가구별 서브컴포넌트(`furniture/*.tsx`)로 분리하고 `PARTY_MAP`에 비충돌 `deco` 레이어(선택 필드) 추가. 가로 전환은 `useLandscapeLock`을 매칭 화면에도 적용.

**Tech Stack:** Expo RN 0.85, react-native-svg 15, expo-screen-orientation, `doodle-path.ts`(wobbleRect/mulberry/hatchSegments), vitest.

**스펙:** `docs/superpowers/specs/2026-07-20-game-world-visual-upgrade-design.md`

## Global Constraints

- 순수 렌더 교체 — 충돌/좌표/소켓/게임 로직 무변경. `party-space.ts`·게이트웨이·`AmongState` 손대지 않는다.
- 색은 `apps/mobile/src/lib/theme.ts` 토큰만: ink `#17150F`, paper `#FFFFFF`, grayMid `#8A857C`, grayLight `#D9D5CC`, fill `#F1EFE9`, fillDeep `#E7E4DC`, accent `#FF5864`, accentSoft `#FF8276`, accentFill `#FF9F9D`. 하드코딩 hex 금지(SVG stroke/fill 포함).
- **UI 이모지 금지** — 아이콘은 Lucide, 게임 내부는 SVG path/도형. ✓·✕·★ 등 모노크롬 기호만 허용.
- 워블/손그림은 `doodle-path.ts`(`wobbleRect`/`mulberry`/`hatchSegments`) — `feTurbulence` 금지(react-native-svg 네이티브 미지원).
- 애니메이션은 `phase`(ms 클록) 기반 순수 계산 — 컴포넌트 내부 타이머/Reanimated 금지(부모 rAF 틱이 리렌더 구동).
- 시드는 `profileId`(캐릭터)·`id`(가구) 해시 — 결정적(재렌더에 파츠/지터가 바뀌지 않음).
- 성능 예산: 캐릭터 SVG 노드 ≤28/개(8인), 맵 SVG 노드 ≤400. 맵은 `memo`(프레임 크기 동일 시 리렌더 안 함).
- shared 수정 시 `pnpm --filter @mingle/shared build`(mobile vitest·backend가 dist 해석). 빌드 순서 shared → client-core → apps.
- mobile 테스트 = 순수 lib 전용 vitest(node env, `src/lib/__tests__/*.test.ts`) — 테스트에서 RN/컴포넌트 import 금지. 컴포넌트는 `npx tsc --noEmit` + `prettier --check` + 웹 스크린샷 육안으로 검증.
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. TS strict.
- 커밋: 한국어 conventional commit + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## 페이즈 1 — 가로 타이밍 + 프레임 제거

### Task 1: 매칭 화면 가로 전환 + 가로 레이아웃

**Files:**
- Modify: `apps/mobile/app/(app)/matching.tsx`

**Interfaces:**
- Consumes: `useLandscapeLock()`(기존 `src/lib/use-landscape.ts` — 인자 없음, focus 시 LANDSCAPE·blur 시 PORTRAIT_UP)
- Produces: 없음(화면 자체)

- [ ] **Step 1: useLandscapeLock 적용 + 가로 레이아웃 조정**

`matching.tsx` 최상단 import에 추가:

```tsx
import { useLandscapeLock } from "../../src/lib/use-landscape";
import { useSafeAreaInsets } from "react-native-safe-area-context";
```

컴포넌트 함수 본문 첫 줄(다른 훅보다 위)에 추가:

```tsx
  useLandscapeLock();
  const insets = useSafeAreaInsets();
```

`styles.center`에 좌우 safe inset이 먹도록, 세 개의 `return`에서 최상위 `View`의 style을 다음처럼 바꾼다(세 곳 모두 `styles.center` 단독 → 배열):

```tsx
    <View style={[styles.center, { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right }]}>
```

(failed·error·waiting 세 return 전부. 기존 `padding: 24`는 `styles.center`에 남겨두되 상하 여백 역할.)

- [ ] **Step 2: tsc + prettier**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 에러 0.
Run: `npx prettier --check "app/(app)/matching.tsx"`
Expected: clean (안 맞으면 `--write`).

- [ ] **Step 3: 웹 스모크(수동)**

`pnpm dev:mobile`(이미 :8081 가동 중이면 스킵) → 브라우저 세로(390×844) → 로그인 → 홈 "매칭 시작" 탭 → `/matching` 진입 시 웹은 orientation lock no-op이나 레이아웃이 안 깨지는지 확인(중앙 정렬 유지). 실기기 가로 전환은 런북 항목(Task 11).

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/matching.tsx"
git commit -m "feat(mobile): 매칭 화면 가로 전환 — 매칭 시작 시점부터 가로"
```

---

### Task 2: 게임 월드 프레임 제거(풀블리드) + 상단바 구분선 제거

**Files:**
- Modify: `apps/mobile/src/components/party/PartyWorld.tsx:133-142`
- Modify: `apps/mobile/app/(app)/party/[id].tsx` (topBar 스타일)

**Interfaces:**
- Consumes: 없음
- Produces: 없음(순수 스타일)

- [ ] **Step 1: PartyWorld floor 프레임 제거**

`PartyWorld.tsx`의 `styles.floor`를 다음으로 교체(테두리·라운드 제거, 바닥 채움은 유지 — 우드 플랭크는 Task 9에서):

```tsx
  floor: {
    position: "absolute",
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
```

`styles.letterbox`의 `backgroundColor: colors.fillDeep`는 유지(레터박스 여백 톤).

- [ ] **Step 2: 파티 상단바 구분선 제거**

`party/[id].tsx`의 `styles.topBar`에서 `borderBottomWidth`·`borderBottomColor` 두 줄을 삭제. 반투명 배경(`rgba(255,255,255,0.88)` 류 기존 값)은 유지해 월드와 분리감 확보. `doodle` import가 topBar에서만 쓰였다면 tsc 경고 없게 다른 사용처 확인 후 유지(대개 다른 스타일에서 `doodle.border`/`doodle.radius` 사용 중 — 삭제하지 말 것).

- [ ] **Step 3: tsc + prettier + 웹 스크린샷**

Run: `cd apps/mobile && npx tsc --noEmit` → 0.
Run: `npx prettier --check "src/components/party/PartyWorld.tsx" "app/(app)/party/[id].tsx"` → clean.
웹 스모크: 파티 화면 진입 → 월드가 프레임 없이 레터박스를 채우는지, 상단바 구분선이 사라졌는지 스크린샷 육안.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/party/PartyWorld.tsx "apps/mobile/app/(app)/party/[id].tsx"
git commit -m "style(mobile): 게임 월드 프레임 제거 — 풀블리드 + 상단바 구분선 제거"
```

---

## 페이즈 2 — character-look 순수 lib

### Task 3: `character-look.ts` — 시드→파츠 선택(순수)

**Files:**
- Create: `apps/mobile/src/lib/character-look.ts`
- Create: `apps/mobile/src/lib/__tests__/character-look.test.ts`

**Interfaces:**
- Consumes: 없음(순수)
- Produces:
  - `type Hair = "short" | "bob" | "ponytail" | "curly" | "twoblock" | "bowl"`
  - `type Outfit = "tee" | "hoodie" | "overall" | "dress"`
  - `type Eyes = "dot" | "half" | "round"`
  - `type Mouth = "smile" | "o" | "line"`
  - `interface CharacterLook { hair: Hair; outfit: Outfit; eyes: Eyes; mouth: Mouth; accent: "cheek" | "string"; seed: number }`
  - `lookFor(key: string): CharacterLook` — key(profileId 또는 name) 해시로 결정적 선택
  - `HAIRS`, `OUTFITS`, `EYES_SET`, `MOUTHS` (readonly 배열 — 컴포넌트가 파츠 렌더 분기에 사용)

- [ ] **Step 1: 실패하는 테스트**

`character-look.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lookFor, HAIRS, OUTFITS, EYES_SET, MOUTHS } from "../character-look";

describe("lookFor", () => {
  it("결정적 — 같은 key는 같은 look", () => {
    expect(lookFor("profile-abc")).toEqual(lookFor("profile-abc"));
  });

  it("모든 파츠가 유효 집합 안이다", () => {
    const l = lookFor("someone");
    expect(HAIRS).toContain(l.hair);
    expect(OUTFITS).toContain(l.outfit);
    expect(EYES_SET).toContain(l.eyes);
    expect(MOUTHS).toContain(l.mouth);
    expect(["cheek", "string"]).toContain(l.accent);
    expect(l.seed).toBeGreaterThan(0);
  });

  it("서로 다른 key는 대체로 다른 조합(분포)", () => {
    const keys = Array.from({ length: 40 }, (_, i) => `k${i}`);
    const combos = new Set(keys.map((k) => JSON.stringify(lookFor(k))));
    // 40개 중 최소 8종 이상 서로 다른 조합이면 편향 아님
    expect(combos.size).toBeGreaterThanOrEqual(8);
  });

  it("빈 문자열도 유효 look을 준다", () => {
    const l = lookFor("");
    expect(HAIRS).toContain(l.hair);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- character-look`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`character-look.ts`:

```ts
/**
 * character-look — profileId/name 시드로 캐릭터 외형 파츠를 결정적으로 선택하는 순수 함수.
 * DoodleCharacter가 이 결과로 헤어/상의/표정/볼터치를 렌더 분기한다(파츠 렌더는 컴포넌트 소관).
 */
export type Hair = "short" | "bob" | "ponytail" | "curly" | "twoblock" | "bowl";
export type Outfit = "tee" | "hoodie" | "overall" | "dress";
export type Eyes = "dot" | "half" | "round";
export type Mouth = "smile" | "o" | "line";

export const HAIRS: readonly Hair[] = ["short", "bob", "ponytail", "curly", "twoblock", "bowl"];
export const OUTFITS: readonly Outfit[] = ["tee", "hoodie", "overall", "dress"];
export const EYES_SET: readonly Eyes[] = ["dot", "half", "round"];
export const MOUTHS: readonly Mouth[] = ["smile", "o", "line"];

export interface CharacterLook {
  hair: Hair;
  outfit: Outfit;
  eyes: Eyes;
  mouth: Mouth;
  accent: "cheek" | "string";
  seed: number;
}

/** djb2 계열 해시 — key당 결정적 uint32. */
function hash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function lookFor(key: string): CharacterLook {
  const h = hash(key);
  // 서로 겹치지 않는 비트 구간에서 각 파츠 인덱스 추출(파츠 간 상관 최소화).
  return {
    hair: HAIRS[h % HAIRS.length]!,
    outfit: OUTFITS[(h >>> 3) % OUTFITS.length]!,
    eyes: EYES_SET[(h >>> 6) % EYES_SET.length]!,
    mouth: MOUTHS[(h >>> 9) % MOUTHS.length]!,
    accent: (h >>> 12) % 2 === 0 ? "cheek" : "string",
    seed: (h % 97) + 1,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @mingle/mobile test -- character-look`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/character-look.ts apps/mobile/src/lib/__tests__/character-look.test.ts
git commit -m "feat(mobile): character-look — 시드 기반 캐릭터 파츠 결정 순수 lib"
```

---

## 페이즈 3 — DoodleCharacter 귀여움 리디자인

### Task 4: `DoodleCharacter` 치비 리디자인(체형·얼굴·볼터치)

**Files:**
- Modify: `apps/mobile/src/components/party/DoodleCharacter.tsx`

**Interfaces:**
- Consumes: Task 3 `lookFor`/`CharacterLook`
- Produces: `DoodleCharacter`/`DoodleCorpse`/`CHAR_BOX` 시그니처 **불변**(props·export 동일 — `PartyWorld` 무변경). `CHAR_BOX = { w: 0.62, h: 1.3 }` 유지.

- [ ] **Step 1: 치비 체형 + 큰 얼굴 + 볼터치로 본체 교체**

`DoodleCharacter.tsx`의 `DoodleCharacter` 함수 내부(리턴 JSX의 `<Svg>` 블록)를 치비 비율로 재구성. props/`CHAR_BOX`/`seedOf`는 유지하되 `lookFor` 사용. 아래 형태로 교체:

- import에 추가: `import { lookFor } from "../../lib/character-look";`
- 비율 상수(함수 상단, 기존 `headR` 등 대체):

```tsx
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
  const inkW = 2.6;
  const face = mine ? colors.ink : colors.paper;
  const feat = mine ? colors.paper : colors.ink;
  const rand = mulberry(look.seed);
  const ghostHem = `M${cx - headR} ${hipY} q${headR / 2} ${4 + rand() * 3} ${headR} 0 q${headR / 2} ${-4 - rand() * 3} ${headR} 0`;
```

(`mulberry`는 이미 파일 상단 import됨. 기존 `seedOf`는 `headPath` seed로 유지하거나 `look.seed`로 통일 — 통일 권장.)

- 머리 path는 기존 `wobbleRect`(둥근 원) 유지하되 `headR` 커진 값 사용, `amp: 0.8, step: 8`. `headPath`는 `look.seed`로 생성.
- `<Svg width={w} height={h}>` 자식 순서: (1) 다리 or 유령 치맛단, (2) 몸통(둥근 상의 실루엣 — Task 5에서 outfit별로, 이 태스크에선 단순 둥근 사각 몸통 path), (3) 팔, (4) 머리 원, (5) 헤어(Task 5), (6) 눈·볼터치·입(Task 5의 표정 분기 자리 — 이 태스크에선 기본 점눈+미소+볼터치).
- 이 태스크의 최소 목표: **큰 머리 + 둥근 몸통 + 통통 팔다리(strokeWidth inkW, round cap) + 볼터치 2개(accentFill) + 눈 하이라이트**. outfit/hair/표정 분기는 Task 5. 우선 아래 코어를 넣는다:

```tsx
        <Svg width={w} height={h}>
          {/* 다리 or 유령 치맛단 */}
          {ghost ? (
            <Path d={ghostHem} stroke={colors.ink} strokeWidth={inkW} fill="none" />
          ) : (
            <>
              <Line x1={cx - 3} y1={hipY} x2={cx - 3 - limb * 0.6 * Math.sin(swing)} y2={h - 2}
                stroke={colors.ink} strokeWidth={inkW} strokeLinecap="round" />
              <Line x1={cx + 3} y1={hipY} x2={cx + 3 + limb * 0.6 * Math.sin(swing)} y2={h - 2}
                stroke={colors.ink} strokeWidth={inkW} strokeLinecap="round" />
            </>
          )}
          {/* 둥근 몸통(상의 실루엣 — Task 5에서 outfit별 교체) */}
          <Path d={bodyPath} fill={colors.paper} stroke={colors.ink} strokeWidth={inkW} strokeLinejoin="round" />
          {/* 팔 */}
          <Line x1={cx} y1={bodyTop + 4} x2={cx - limb * Math.cos(0.8 - swing * 0.5)}
            y2={bodyTop + 4 + limb * Math.sin(0.8 - swing * 0.5)} stroke={colors.ink} strokeWidth={inkW} strokeLinecap="round" />
          <Line x1={cx} y1={bodyTop + 4} x2={cx + limb * Math.cos(0.8 + swing * 0.5)}
            y2={bodyTop + 4 + limb * Math.sin(0.8 + swing * 0.5)} stroke={colors.ink} strokeWidth={inkW} strokeLinecap="round" />
          {/* 머리 */}
          <Path d={headPath} x={cx - headR} y={headCy - headR} fill={face} stroke={colors.ink} strokeWidth={inkW} />
          {/* 볼터치(accentFill) — 내 캐릭터는 잉크 머리라 생략 */}
          {!mine && (
            <>
              <Circle cx={cx - headR * 0.55} cy={headCy + headR * 0.28} r={headR * 0.16} fill={colors.accentFill} opacity={0.85} />
              <Circle cx={cx + headR * 0.55} cy={headCy + headR * 0.28} r={headR * 0.16} fill={colors.accentFill} opacity={0.85} />
            </>
          )}
          {/* 눈(점) + 하이라이트 + 입(미소) */}
          <Circle cx={cx - headR * 0.34} cy={headCy - headR * 0.05} r={2.1} fill={feat} />
          <Circle cx={cx + headR * 0.34} cy={headCy - headR * 0.05} r={2.1} fill={feat} />
          <Circle cx={cx - headR * 0.34 + 0.8} cy={headCy - headR * 0.05 - 0.8} r={0.7} fill={face} />
          <Circle cx={cx + headR * 0.34 + 0.8} cy={headCy - headR * 0.05 - 0.8} r={0.7} fill={face} />
          <Path d={`M${cx - 3.5} ${headCy + headR * 0.42} q3.5 3.5 7 0`} stroke={feat} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </Svg>
```

`bodyPath`는 함수 상단에서 둥근 사다리꼴/사각 실루엣으로 계산:

```tsx
  const bodyW = size * 0.42;
  const bodyPath = wobbleRect(
    bodyW,
    hipY - bodyTop,
    { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomRightRadius: 5, borderBottomLeftRadius: 5 },
    look.seed,
    { amp: 0.7, step: 9 },
  );
```

그리고 몸통 `<Path>`에 `x={cx - bodyW / 2} y={bodyTop}` 위치를 준다(wobbleRect는 0,0 기준 path이므로 `<Path>` 요소에 x/y로 이동 — react-native-svg 지원, 기존 headPath 패턴과 동일).

`ghostHem`은 headR 커진 값 기준으로 유지(기존 식에서 `headR` 참조 그대로).

- [ ] **Step 2: tsc + prettier**

Run: `cd apps/mobile && npx tsc --noEmit` → 0.
Run: `npx prettier --check "src/components/party/DoodleCharacter.tsx"` → clean(안 맞으면 --write).

- [ ] **Step 3: mobile vitest(회귀 — 캐릭터는 컴포넌트라 직접 테스트 없음, 전체 lib 그린 확인)**

Run: `pnpm --filter @mingle/mobile test`
Expected: 전부 PASS(character-look 포함).

- [ ] **Step 4: 웹 스크린샷 육안**

파티 화면(로비/게임) 진입 → 캐릭터가 큰 머리·둥근 몸통·볼터치로 귀엽게 렌더되는지, 8인 밀집에서 깨지지 않는지 스크린샷. `left`/`top` 오프셋(`PartyWorld`의 `CHAR_BOX.h` 기반)이 여전히 발끝 정렬 유지하는지 확인(발이 바닥에 닿는 느낌).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/party/DoodleCharacter.tsx
git commit -m "feat(mobile): DoodleCharacter 치비 리디자인 — 큰 머리·둥근 몸통·볼터치"
```

---

### Task 5: 캐릭터 파츠 분기(헤어·상의·표정)

**Files:**
- Modify: `apps/mobile/src/components/party/DoodleCharacter.tsx`

**Interfaces:**
- Consumes: Task 3 `lookFor`(이미 Task 4에서 import), `CharacterLook`
- Produces: 캐릭터가 `look.hair`/`look.outfit`/`look.eyes`/`look.mouth`/`look.accent`에 따라 파츠를 그린다. 시그니처 불변.

- [ ] **Step 1: 파츠 헬퍼 함수 3개를 파일 하단에 추가**

`DoodleCharacter.tsx` 하단(styles 위)에 순수 렌더 헬퍼 추가 — 각각 `ReactNode` 배열/프래그먼트 반환. `react-native-svg`의 `Path`/`Circle`/`Line`은 이미 import됨. `import type { Hair, Outfit, Eyes, Mouth } from "../../lib/character-look";` 추가.

```tsx
function Hairstyle({ hair, cx, headCy, headR }: { hair: Hair; cx: number; headCy: number; headR: number }) {
  const top = headCy - headR;
  const iw = 2.4;
  switch (hair) {
    case "short":
      return <Path d={`M${cx - headR} ${headCy - headR * 0.2} q${headR} ${-headR * 1.4} ${headR * 2} 0`} stroke={colors.ink} strokeWidth={iw} fill={colors.ink} />;
    case "bob":
      return <Path d={`M${cx - headR - 1} ${headCy} q0 ${-headR * 1.5} ${headR + 1} ${-headR * 1.5} q${headR + 1} 0 ${headR + 1} ${headR * 1.5} l0 2 q${-headR} ${-6} ${-headR * 2} 0 z`} fill={colors.ink} stroke={colors.ink} strokeWidth={1} />;
    case "ponytail":
      return (
        <>
          <Path d={`M${cx - headR} ${headCy - headR * 0.3} q${headR} ${-headR * 1.3} ${headR * 2} 0`} fill={colors.ink} stroke={colors.ink} strokeWidth={iw} />
          <Path d={`M${cx + headR * 0.8} ${top + headR * 0.4} q${headR * 0.9} ${headR * 0.3} ${headR * 0.4} ${headR * 1.4}`} stroke={colors.ink} strokeWidth={iw + 1} fill="none" strokeLinecap="round" />
        </>
      );
    case "curly":
      return (
        <>
          {[-0.7, -0.25, 0.25, 0.7].map((t, i) => (
            <Circle key={i} cx={cx + headR * t} cy={top + headR * 0.25} r={headR * 0.3} fill={colors.ink} />
          ))}
        </>
      );
    case "twoblock":
      return <Path d={`M${cx - headR} ${headCy - headR * 0.5} q${headR} ${-headR} ${headR * 2} 0 l0 ${headR * 0.35} q${-headR} ${-headR * 0.5} ${-headR * 2} 0 z`} fill={colors.ink} />;
    case "bowl":
      return <Path d={`M${cx - headR - 1} ${headCy - headR * 0.1} q0 ${-headR * 1.4} ${headR + 1} ${-headR * 1.4} q${headR + 1} 0 ${headR + 1} ${headR * 1.4} q${-headR} ${-4} ${-headR * 2} 0 z`} fill={colors.ink} />;
  }
}

function OutfitDetail({ outfit, cx, bodyTop, bodyW, hipY }: { outfit: Outfit; cx: number; bodyTop: number; bodyW: number; hipY: number }) {
  const iw = 1.6;
  const midY = (bodyTop + hipY) / 2;
  switch (outfit) {
    case "tee":
      return <Path d={`M${cx - bodyW * 0.28} ${bodyTop + 2} q${bodyW * 0.28} 5 ${bodyW * 0.56} 0`} stroke={colors.ink} strokeWidth={iw} fill="none" />;
    case "hoodie":
      return (
        <>
          <Path d={`M${cx - bodyW * 0.3} ${bodyTop + 1} q${bodyW * 0.3} 7 ${bodyW * 0.6} 0`} stroke={colors.ink} strokeWidth={iw} fill="none" />
          <Line x1={cx - 2} y1={bodyTop + 3} x2={cx - 2} y2={midY} stroke={colors.accentSoft} strokeWidth={iw} strokeLinecap="round" />
          <Line x1={cx + 2} y1={bodyTop + 3} x2={cx + 2} y2={midY} stroke={colors.accentSoft} strokeWidth={iw} strokeLinecap="round" />
        </>
      );
    case "overall":
      return (
        <>
          <Line x1={cx - bodyW * 0.22} y1={bodyTop + 1} x2={cx - bodyW * 0.22} y2={midY} stroke={colors.ink} strokeWidth={iw} />
          <Line x1={cx + bodyW * 0.22} y1={bodyTop + 1} x2={cx + bodyW * 0.22} y2={midY} stroke={colors.ink} strokeWidth={iw} />
          <Line x1={cx - bodyW * 0.3} y1={midY} x2={cx + bodyW * 0.3} y2={midY} stroke={colors.ink} strokeWidth={iw} />
        </>
      );
    case "dress":
      return <Path d={`M${cx - bodyW * 0.3} ${midY} L${cx - bodyW * 0.5} ${hipY} M${cx + bodyW * 0.3} ${midY} L${cx + bodyW * 0.5} ${hipY}`} stroke={colors.ink} strokeWidth={iw} fill="none" />;
  }
}

function FaceFeatures({ eyes, mouth, cx, headCy, headR, feat, face }: { eyes: Eyes; mouth: Mouth; cx: number; headCy: number; headR: number; feat: string; face: string }) {
  const ex = headR * 0.34;
  const ey = headCy - headR * 0.05;
  const eyeNode = (sign: number) => {
    if (eyes === "half") return <Path key={sign} d={`M${cx + sign * ex - 2.2} ${ey} q2.2 2.4 4.4 0`} stroke={feat} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
    const r = eyes === "round" ? 2.7 : 2.1;
    return (
      <React.Fragment key={sign}>
        <Circle cx={cx + sign * ex} cy={ey} r={r} fill={feat} />
        <Circle cx={cx + sign * ex + 0.8} cy={ey - 0.8} r={0.8} fill={face} />
      </React.Fragment>
    );
  };
  const my = headCy + headR * 0.42;
  const mouthNode =
    mouth === "o" ? (
      <Circle cx={cx} cy={my} r={1.8} fill="none" stroke={feat} strokeWidth={1.6} />
    ) : mouth === "line" ? (
      <Line x1={cx - 3} y1={my} x2={cx + 3} y2={my} stroke={feat} strokeWidth={1.6} strokeLinecap="round" />
    ) : (
      <Path d={`M${cx - 3.5} ${my - 1} q3.5 3.5 7 0`} stroke={feat} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    );
  return (
    <>
      {eyeNode(-1)}
      {eyeNode(1)}
      {mouthNode}
    </>
  );
}
```

파일 상단 import에 `import React from "react";` 추가(위 `React.Fragment` 사용 — 이미 다른 곳에서 안 쓰면 필요).

- [ ] **Step 2: 본체에서 파츠 헬퍼 사용**

Task 4의 하드코딩 눈/입/볼터치·헤어 자리에 헬퍼를 끼운다:
- 머리 `<Path>` 뒤에 `<Hairstyle hair={look.hair} cx={cx} headCy={headCy} headR={headR} />`.
- 몸통 `<Path>` 뒤에 `<OutfitDetail outfit={look.outfit} cx={cx} bodyTop={bodyTop} bodyW={bodyW} hipY={hipY} />`.
- Task 4의 인라인 눈/입 대신 `<FaceFeatures eyes={look.eyes} mouth={look.mouth} cx={cx} headCy={headCy} headR={headR} feat={feat} face={face} />`.
- 볼터치는 `look.accent === "cheek"`일 때만 그린다(기존 `!mine &&` 조건에 `look.accent === "cheek"` 추가). `look.accent === "string"`이면 후드 스트링(hoodie가 아니어도 목 아래 짧은 리본 라인 accentSoft 1개)로 대체 — 단순화: cheek면 볼터치, string이면 볼터치 생략(hoodie outfit이 이미 스트링을 그림). 즉 볼터치 조건 = `!mine && look.accent === "cheek"`.

- [ ] **Step 3: tsc + prettier + vitest**

Run: `cd apps/mobile && npx tsc --noEmit` → 0.
Run: `npx prettier --check "src/components/party/DoodleCharacter.tsx"` → clean.
Run: `pnpm --filter @mingle/mobile test` → 전부 PASS.

- [ ] **Step 4: 웹 스크린샷 — 파츠 다양성 육안**

로비/게임에서 여러 캐릭터가 서로 다른 헤어·상의·표정으로 렌더되는지, 겹침/클리핑 없는지 스크린샷. 8인 밀집 1장, 유령·시체 1장.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/party/DoodleCharacter.tsx
git commit -m "feat(mobile): 캐릭터 파츠 분기 — 헤어 6·상의 4·표정 9종 조합"
```

---

### Task 6: 유령·시체 귀여움 리디자인 + 발밑 그림자

**Files:**
- Modify: `apps/mobile/src/components/party/DoodleCharacter.tsx`

**Interfaces:**
- Consumes: 없음(같은 파일 내부)
- Produces: `DoodleCorpse` 시그니처 불변. 캐릭터에 발밑 그림자 타원 추가.

- [ ] **Step 1: 발밑 그림자 타원(캐릭터 본체)**

`DoodleCharacter`의 `<Svg>` 최하단(다리보다 먼저 그려 뒤로 가게 — 첫 자식)에 지면 그림자 추가(유령은 생략):

```tsx
          {!ghost && (
            <Path
              d={`M${cx - size * 0.14} ${h - 2} a${size * 0.14} ${size * 0.045} 0 1 0 ${size * 0.28} 0 a${size * 0.14} ${size * 0.045} 0 1 0 ${-size * 0.28} 0`}
              fill={colors.ink}
              opacity={0.12}
            />
          )}
```

- [ ] **Step 2: 유령 표정 유지 + 시체 리터치**

- 유령: 기존 `ghost` 분기가 다리 대신 치맛단만 그리는데, 얼굴(눈·입)은 `FaceFeatures`가 여전히 그리도록 유지(귀여운 유령). opacity 0.45 유지. 볼터치는 유령일 때 생략(이미 `!mine && cheek` 조건이므로 유령도 mine 아니면 나올 수 있음 — `ghost`면 볼터치 생략 조건 추가: `!mine && !ghost && look.accent === "cheek"`).
- `DoodleCorpse`: 기존 X눈 유지하되 머리 아래 작은 잉크 얼룩 그림자 타원 추가(누운 몸 아래):

```tsx
        <Path d={`M${headR} ${cy + headR * 0.9} a${headR * 1.1} ${headR * 0.3} 0 1 0 ${headR * 2.2} 0 a${headR * 1.1} ${headR * 0.3} 0 1 0 ${-headR * 2.2} 0`} fill={colors.ink} opacity={0.12} />
```

(시체 `<Svg>` 첫 자식으로.)

- [ ] **Step 3: tsc + prettier + vitest + 웹 스크린샷**

Run: `cd apps/mobile && npx tsc --noEmit` → 0. `npx prettier --check` → clean. `pnpm --filter @mingle/mobile test` → PASS.
웹: 캐릭터 발밑 그림자로 접지감, 유령이 표정 있는 귀여운 형태, 시체 얼룩 확인.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/party/DoodleCharacter.tsx
git commit -m "feat(mobile): 유령·시체 귀여움 리터치 + 발밑 접지 그림자"
```

---

## 페이즈 4 — 맵/가구/deco

### Task 7: shared `PARTY_MAP` deco 레이어(선택 필드)

**Files:**
- Modify: `packages/shared/src/party-map/map.ts`
- Modify: `packages/shared/src/party-map/map.test.ts`
- Modify: `packages/shared/src/index.ts` (export)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type DecoKind = "window" | "frame" | "stringlights" | "stain"`
  - `interface DecoDef { id: string; kind: DecoKind; x: number; y: number; w: number; h: number }`
  - `PartyMapDef.deco?: readonly DecoDef[]` (선택 — 충돌 무관, 클라 렌더 전용)
  - `PARTY_MAP.deco` 채워짐(창문·액자·스트링라이트·얼룩 5~7개)
  - export: `DecoKind`, `DecoDef`

- [ ] **Step 1: 실패하는 무결성 테스트**

`map.test.ts`의 `PARTY_MAP integrity` describe 안에 추가(파일 상단 import에 `DecoDef` 추가):

```ts
  it("deco 레이어는 방(0..1) 안에 있고 충돌 데이터가 아니다", () => {
    const deco = PARTY_MAP.deco ?? [];
    expect(deco.length).toBeGreaterThan(0);
    const ids = deco.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of deco) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.x + d.w).toBeLessThanOrEqual(1);
      expect(d.y + d.h).toBeLessThanOrEqual(1);
    }
    // deco는 solidFurniture에 절대 섞이지 않는다(충돌 무관)
    const solidIds = new Set(solidFurniture().map((f) => f.id));
    for (const d of deco) expect(solidIds.has(d.id)).toBe(false);
  });
```

(`solidFurniture`가 test에서 import되어 있는지 확인 — 없으면 import 추가.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @mingle/shared test`
Expected: FAIL — `deco` 없음.

- [ ] **Step 3: 구현**

`map.ts`:

```ts
export type DecoKind = "window" | "frame" | "stringlights" | "stain";

/** 비충돌 장식 레이어 — 클라 렌더 전용(충돌/좌표 판정에 미포함). */
export interface DecoDef {
  id: string;
  kind: DecoKind;
  x: number;
  y: number;
  w: number;
  h: number;
}
```

`PartyMapDef`에 `deco?: readonly DecoDef[];` 추가. `PARTY_MAP` 객체에 `spawnZone` 뒤에 `deco` 추가:

```ts
  deco: [
    { id: "win-1", kind: "window", x: 0.3, y: 0.03, w: 0.12, h: 0.08 },
    { id: "win-2", kind: "window", x: 0.5, y: 0.03, w: 0.12, h: 0.08 },
    { id: "frame-1", kind: "frame", x: 0.16, y: 0.05, w: 0.06, h: 0.06 },
    { id: "lights", kind: "stringlights", x: 0.05, y: 0.02, w: 0.9, h: 0.05 },
    { id: "stain-1", kind: "stain", x: 0.46, y: 0.5, w: 0.06, h: 0.04 },
    { id: "stain-2", kind: "stain", x: 0.2, y: 0.6, w: 0.05, h: 0.03 },
  ],
```

`index.ts`의 party-map export 블록에 `DecoKind`, `DecoDef` type export 추가.

- [ ] **Step 4: 통과 + 빌드**

Run: `pnpm --filter @mingle/shared test` → PASS. `pnpm --filter @mingle/shared build` → 성공.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/party-map
git commit -m "feat(shared): PARTY_MAP deco 레이어 — 비충돌 환경 소품(창문·액자·라이트·얼룩)"
```

---

### Task 8: 가구 서브컴포넌트 분리 + 일러스트화

**Files:**
- Create: `apps/mobile/src/components/party/furniture/index.tsx` (kind→컴포넌트 라우팅 + 공통 outline)
- Modify: `apps/mobile/src/components/party/PartyMapArt.tsx` (FurniturePiece를 서브컴포넌트로 위임)

**Interfaces:**
- Consumes: `wobbleRect`(doodle-path), `colors`(theme), `FurnitureDef`/`isSolid`(shared)
- Produces: `FurniturePiece({ f, width, height })` — 기존 시그니처 유지, 내부만 kind별 서브컴포넌트로 위임. `furniture/index.tsx`가 `renderFurnitureDetail(kind, w, h): ReactNode` 제공.

- [ ] **Step 1: `furniture/index.tsx` — kind별 디테일 렌더 순수 함수**

기존 `PartyMapArt.tsx`의 kind별 인라인 SVG를 이 파일로 옮기고 디테일을 대폭 강화. 각 함수는 `w`/`h`(픽셀) 받아 `ReactNode` 반환. `Svg` 컨텍스트 안에서 쓰이므로 `Path`/`Circle`/`Line`/`Rect` 등만 사용.

```tsx
import type { ReactNode } from "react";
import { Circle, Line, Path, Rect } from "react-native-svg";
import type { FurnitureKind } from "@mingle/shared";
import { colors } from "../../../lib/theme";

const ink = colors.ink;

/** kind별 가구 내부 디테일(아웃라인은 FurniturePiece가 그림). 좌표는 0..w, 0..h. */
export function renderFurnitureDetail(kind: FurnitureKind, w: number, h: number): ReactNode {
  switch (kind) {
    case "bar":
      return (
        <>
          {/* 카운터 상판 해칭 */}
          <Line x1={w * 0.08} y1={h * 0.68} x2={w * 0.92} y2={h * 0.68} stroke={ink} strokeWidth={1.6} />
          {/* 병 3 */}
          {[0.25, 0.42, 0.59].map((t, i) => (
            <Rect key={i} x={w * t} y={h * (0.28 - i * 0.02)} width={w * 0.05} height={h * 0.36} rx={2} stroke={ink} strokeWidth={1.3} fill="none" />
          ))}
          {/* 스툴 2 */}
          {[0.2, 0.75].map((t, i) => (
            <Circle key={`s${i}`} cx={w * t} cy={h * 0.86} r={Math.min(w, h) * 0.08} stroke={ink} strokeWidth={1.4} fill="none" />
          ))}
        </>
      );
    case "table":
      return (
        <>
          <Circle cx={w / 2} cy={h / 2} r={Math.min(w, h) * 0.26} stroke={ink} strokeWidth={1.6} fill="none" />
          {/* 컵·접시 */}
          <Circle cx={w * 0.4} cy={h * 0.45} r={2.4} stroke={ink} strokeWidth={1.2} fill="none" />
          <Circle cx={w * 0.6} cy={h * 0.55} r={3} stroke={ink} strokeWidth={1.2} fill="none" />
          {/* 의자 2 */}
          {[0.12, 0.88].map((t, i) => (
            <Rect key={i} x={w * t - w * 0.05} y={h * 0.4} width={w * 0.1} height={h * 0.2} rx={2} stroke={ink} strokeWidth={1.3} fill="none" />
          ))}
        </>
      );
    case "sofa":
      return (
        <>
          <Path d={`M${w * 0.1} ${h * 0.5} h${w * 0.8}`} stroke={ink} strokeWidth={1.6} fill="none" />
          {/* 쿠션 분할 + 팔걸이 */}
          <Line x1={w * 0.5} y1={h * 0.3} x2={w * 0.5} y2={h * 0.62} stroke={ink} strokeWidth={1.4} />
          <Path d={`M${w * 0.06} ${h * 0.35} v${h * 0.35}`} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <Path d={`M${w * 0.94} ${h * 0.35} v${h * 0.35}`} stroke={ink} strokeWidth={2} strokeLinecap="round" />
        </>
      );
    case "dj":
      return (
        <>
          {/* 턴테이블 2 */}
          {[0.3, 0.7].map((t, i) => (
            <Circle key={i} cx={w * t} cy={h * 0.5} r={Math.min(w, h) * 0.22} stroke={ink} strokeWidth={1.6} fill="none" />
          ))}
          {[0.3, 0.7].map((t, i) => (
            <Circle key={`d${i}`} cx={w * t} cy={h * 0.5} r={2} fill={ink} />
          ))}
          {/* 믹서 노브 */}
          {[0.42, 0.5, 0.58].map((t, i) => (
            <Circle key={`k${i}`} cx={w * t} cy={h * 0.82} r={1.6} stroke={ink} strokeWidth={1.2} fill="none" />
          ))}
        </>
      );
    case "plant":
      return (
        <>
          {/* 화분 무늬 */}
          <Rect x={w * 0.28} y={h * 0.58} width={w * 0.44} height={h * 0.36} rx={3} stroke={ink} strokeWidth={1.4} fill="none" />
          <Line x1={w * 0.28} y1={h * 0.66} x2={w * 0.72} y2={h * 0.66} stroke={ink} strokeWidth={1.2} />
          {/* 잎 클러스터 */}
          {[-0.28, -0.1, 0.1, 0.28].map((t, i) => (
            <Path key={i} d={`M${w / 2} ${h * 0.58} q${w * t * 1.4} ${-h * 0.3} ${w * t} ${-h * 0.5}`} stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          ))}
        </>
      );
    case "stage":
    case "rug":
      return null; // 통행 가능 — 아웃라인(점선)만
  }
}
```

- [ ] **Step 2: `PartyMapArt.tsx`의 FurniturePiece가 위임**

`PartyMapArt.tsx`에서 kind별 인라인 블록을 전부 삭제하고 `renderFurnitureDetail` 호출로 교체. solid 가구에는 하드 오프셋 잉크 그림자를 추가(부유감 제거):

```tsx
import { renderFurnitureDetail } from "./furniture";
import { doodle } from "../../lib/theme";
// FurniturePiece 내부, <G x={x} y={y}> 안:
      {solid && (
        <Path d={outline} fill={ink} opacity={0.1}
          transform={`translate(${doodle.shadow.x * 0.5}, ${doodle.shadow.y * 0.5})`} />
      )}
      <Path d={outline} fill={solid ? colors.paper : "none"} stroke={colors.ink} strokeWidth={2}
        strokeDasharray={solid ? undefined : "6 5"} opacity={solid ? 1 : 0.55} />
      {renderFurnitureDetail(f.kind, w, h)}
```

(`doodle` import 추가. 그림자는 아웃라인 뒤에 먼저 그림 — G 안 첫 자식.)

- [ ] **Step 3: tsc + prettier + vitest + 노드 예산 육안**

Run: `cd apps/mobile && npx tsc --noEmit` → 0. `npx prettier --check "src/components/party/furniture/index.tsx" "src/components/party/PartyMapArt.tsx"` → clean. `pnpm --filter @mingle/mobile test` → PASS.
웹 스크린샷: 가구가 일러스트(스툴·병·잎·턴테이블)로 보이는지, 그림자로 접지감, 성능 무리 없는지.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/party/furniture apps/mobile/src/components/party/PartyMapArt.tsx
git commit -m "feat(mobile): 가구 일러스트화 + 서브컴포넌트 분리 + 접지 그림자"
```

---

### Task 9: 우드 플랭크 바닥 + deco 렌더 + 마커 리디자인

**Files:**
- Modify: `apps/mobile/src/components/party/PartyMapArt.tsx` (바닥 플랭크 + deco)
- Modify: `apps/mobile/src/components/party/PartyWorld.tsx` (마커 스타일)

**Interfaces:**
- Consumes: Task 7 `PARTY_MAP.deco`/`DecoDef`
- Produces: 없음(렌더)

- [ ] **Step 1: PartyMapArt에 우드 플랭크 바닥 + deco**

`PartyMapArt` `<Svg>` 최상단(가구보다 먼저 — 배경)에 바닥 플랭크 라인과 deco 렌더 추가. 플랭크 = 성긴 가로줄 + 짧은 세로 이음선, 낮은 opacity. deco는 kind별 간단 렌더 함수 `renderDeco`(furniture/index.tsx 또는 PartyMapArt 내부 헬퍼).

`PartyMapArt.tsx` 상단에 헬퍼:

```tsx
import { PARTY_MAP, isSolid, type FurnitureDef, type DecoDef } from "@mingle/shared";

function Floor({ width, height }: { width: number; height: number }) {
  const rows = 6;
  const lines = [];
  for (let i = 1; i < rows; i++) {
    const y = (height / rows) * i;
    lines.push(<Line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke={colors.grayLight} strokeWidth={1} opacity={0.5} />);
    // 짧은 이음선(엇갈리게)
    const seam = width * (i % 2 === 0 ? 0.33 : 0.66);
    lines.push(<Line key={`v${i}`} x1={seam} y1={y} x2={seam} y2={y - height / rows} stroke={colors.grayLight} strokeWidth={1} opacity={0.4} />);
  }
  return <>{lines}</>;
}

function Deco({ d, width, height }: { d: DecoDef; width: number; height: number }) {
  const x = d.x * width, y = d.y * height, w = d.w * width, h = d.h * height;
  switch (d.kind) {
    case "window":
      return (
        <G x={x} y={y}>
          <Rect x={0} y={0} width={w} height={h} rx={3} stroke={colors.ink} strokeWidth={1.6} fill={colors.paper} opacity={0.9} />
          <Line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke={colors.ink} strokeWidth={1.2} />
          <Line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={colors.ink} strokeWidth={1.2} />
        </G>
      );
    case "frame":
      return <Rect x={x} y={y} width={w} height={h} rx={2} stroke={colors.ink} strokeWidth={1.6} fill="none" />;
    case "stringlights":
      return (
        <G x={x} y={y}>
          <Path d={`M0 0 Q${w * 0.25} ${h} ${w * 0.5} ${h * 0.4} T${w} 0`} stroke={colors.ink} strokeWidth={1.2} fill="none" opacity={0.6} />
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => (
            <Circle key={i} cx={w * t} cy={h * 0.4 + Math.sin(t * 9) * 3} r={2} fill={colors.accentSoft} />
          ))}
        </G>
      );
    case "stain":
      return <Path d={`M${x} ${y} a${w / 2} ${h / 2} 0 1 0 ${w} 0 a${w / 2} ${h / 2} 0 1 0 ${-w} 0`} fill={colors.ink} opacity={0.06} />;
  }
}
```

`PartyMapArt` 본체 `<Svg>` 자식 순서: `<Floor/>` → deco(`(PARTY_MAP.deco ?? []).map`) → 가구(sorted). 즉 바닥 → 벽 소품 → 가구 → (캐릭터는 PartyWorld가 위에 절대배치).

- [ ] **Step 2: PartyWorld 마커 리디자인(코랄 링)**

`PartyWorld.tsx`의 `styles.taskMarker`를 사각형에서 링(원)으로:

```tsx
  taskMarker: {
    position: "absolute",
    width: TASK_MARKER,
    height: TASK_MARKER,
    borderWidth: 2.4,
    borderColor: colors.accent,
    borderRadius: TASK_MARKER / 2,
    backgroundColor: "transparent",
  },
```

`balanceMarker`는 유지(이미 원형 코랄). deco/플랭크가 PartyMapArt 배경이라 마커는 그 위에 잘 보임.

- [ ] **Step 3: tsc + prettier + vitest + 웹 스크린샷**

Run: `cd apps/mobile && npx tsc --noEmit` → 0. prettier check 두 파일 → clean. vitest → PASS.
웹: 바닥 플랭크·창문·스트링라이트·얼룩이 은은하게, 태스크 마커가 코랄 링으로 보이는지. 전체가 프레임 없이 꽉 찬 방처럼.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/party/PartyMapArt.tsx apps/mobile/src/components/party/PartyWorld.tsx
git commit -m "feat(mobile): 우드 플랭크 바닥 + 환경 소품 렌더 + 코랄 링 마커"
```

---

## 페이즈 5 — 통합·검증

### Task 10: 성능·정합 점검 + 잔재 정리

**Files:**
- 검증 위주(코드 변경은 발견 시)

- [ ] **Step 1: SVG 노드 예산 확인**

`renderFurnitureDetail`·`Deco`·`Floor`의 노드 수를 세어 맵 총합 ≤400 확인(가구 9 × ~8 + deco 6 × ~4 + floor ~10 ≈ 100 예상 — 여유). 캐릭터는 `DoodleCharacter` 자식 수를 세어 ≤28 확인(그림자1+다리2+몸통1+outfit≤3+팔2+머리1+헤어≤4+표정≤5+볼터치2 ≈ 21). 초과 시 디테일 감축.

- [ ] **Step 2: 발끝 정렬·좌표 정합 회귀**

`CHAR_BOX = { w: 0.62, h: 1.3 }` 불변 확인(`grep -n "CHAR_BOX" apps/mobile/src/components/party/`). `PartyWorld`의 캐릭터 오프셋 식이 그대로이므로 발끝 정렬 유지 — 웹에서 캐릭터 발이 바닥에 닿고 가구 뒤/앞 페인터 정렬(y 정렬)이 자연스러운지 육안.

- [ ] **Step 3: 전체 게이트**

Run: `pnpm --filter @mingle/shared build`
Run: `pnpm --filter @mingle/mobile test` → 전부 PASS(character-look 포함).
Run: `cd apps/mobile && npx tsc --noEmit` → 0.
Run(웹 번들 스모크): `cd apps/mobile && npx expo export --platform web --output-dir /private/tmp/mingle-web-smoke` → 에러 0(경고 허용).

- [ ] **Step 4: Commit(변경 있을 때만)**

```bash
git add -A apps/mobile
git commit -m "fix(mobile): 비주얼 강화 성능·정합 점검 반영"
```

(변경 없으면 스킵.)

---

### Task 11: 문서 + 런북

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/qa/2026-07-14-native-e2e-runbook.md`

- [ ] **Step 1: CLAUDE.md 갱신**

- 파티 게임 월드 줄: 캐릭터 = 치비 두들(헤어/상의/표정 시드 변주, `character-look.ts`), 맵 = 일러스트 가구 + `deco` 레이어, **월드 프레임 없음(풀블리드)** 반영.
- 가로 규칙 줄: "파티 화면 가로" → "매칭 시작(매칭 화면)부터 가로, 파티까지 유지" 갱신.
- 두들 프리미티브 절: `character-look.ts`·`furniture/` 한 줄 추가.

- [ ] **Step 2: 런북 항목 추가**

가로 게임 월드 섹션(§7/§8)에:

```markdown
- [ ] 매칭 시작 탭 → 매칭 대기 화면부터 가로 전환(파티까지 유지, 나가기 시 세로 복귀)
- [ ] 게임 월드 프레임 없이 화면을 꽉 채움(테두리 상자 아님)
- [ ] 캐릭터가 귀여운 치비(큰 머리·볼터치), 유저마다 헤어·상의·표정 다름
- [ ] 8인 밀집·유령·시체에서 프레임 드랍/클리핑 없음(저사양 안드로이드)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/qa/2026-07-14-native-e2e-runbook.md
git commit -m "docs: 비주얼 강화 반영 — CLAUDE.md 캐릭터·맵·가로 규칙 + 런북 항목"
```

---

## 리스크·주의 (구현자용)

- **순수 렌더 교체 원칙 절대 준수** — `CHAR_BOX` 값·`DoodleCharacter`/`DoodleCorpse`/`PartyWorld`/`PartyMapArt` **시그니처 불변**. 좌표/충돌/소켓 손대지 말 것(그러면 게임 회귀).
- shared `deco` 추가 후 `pnpm --filter @mingle/shared build` 잊지 말 것(mobile vitest가 dist 해석).
- `wobbleRect`는 0,0 기준 path 문자열 — 위치 이동은 `<Path x={} y={}>`(react-native-svg 공용 transform prop, 기존 headPath 패턴). `Rect`/`Circle`은 자체 좌표.
- 노드 예산: 캐릭터 ≤28·맵 ≤400. 8인 rAF 리렌더가 캐릭터만 — 맵은 memo라 정적. 초과 시 디테일 감축(성능 > 디테일).
- `React.Fragment` key 필요한 곳(FaceFeatures eyeNode) 빠뜨리면 콘솔 경고 — key 유지.
- 색은 토큰만. SVG stroke/fill에 hex 리터럴 절대 금지(리뷰 자동 반려 사유).
