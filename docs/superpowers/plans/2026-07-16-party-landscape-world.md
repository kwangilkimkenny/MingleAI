# 파티 가로형 게임 월드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파티 화면을 가로 고정 2D 게임 월드로 개편 — 좌측 가상 조이스틱 이동, 우측 액션패드 상호작용, 가구·충돌 있는 파티장 맵(로비·어몽 공용), 두들 인형 캐릭터.

**Architecture:** 맵 데이터(`PARTY_MAP`)를 `@mingle/shared`에 두고 클라 렌더와 백엔드 태스크 배치가 공유한다. 좌표는 기존 정규화 0..1을 유지하되 거리·이동은 **world 계량**(x에 aspect 1.9 곱)으로 계산해 시각-판정을 일치시킨다. 소켓 프로토콜(`party:move` 등)과 서버 판정은 무변경(서버는 킬/태스크 근접 검증을 하지 않음 — 거리 판정은 순수 클라). 렌더는 플레인 RN View + react-native-svg 유지.

**Tech Stack:** Expo SDK 56 / RN 0.85, react-native-svg, PanResponder(RN core), expo-screen-orientation(신규), NestJS 10, vitest(shared·mobile) + jest(backend).

**스펙:** `docs/superpowers/specs/2026-07-15-party-landscape-world-design.md`

## Global Constraints

- 빌드 순서: shared → client-core → apps. shared 수정 후 반드시 `pnpm --filter @mingle/shared build` (backend가 CJS로 runtime require).
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. TS `strict`.
- mobile 테스트 = 순수 lib 전용 vitest(node env, `src/**/*.test.ts`) — 테스트 파일에서 RN/컴포넌트 import 금지.
- RN `<Button>` 금지 — `DoodleButton`. 아이콘 = lucide-react-native outline. MUI/RN Paper 금지.
- 색은 `apps/mobile/src/lib/theme.ts` 토큰만. 화면당 primary(코랄) 1개.
- Gaegu(`fonts.display`)는 14px 미만 금지. 본문은 시스템 산스.
- `feTurbulence` 금지 — 워블은 `doodle-path.ts` `wobbleRect`. 단면 `borderStyle:"dashed"` 금지 — SVG `strokeDasharray` 또는 `DashedLine`.
- `Motion.tsx` 등장 모션은 게임 내부(파티 월드) 미적용.
- `prisma migrate` 실행 금지(이번 작업에 마이그레이션 없음 — 태스크 좌표는 `GameSession.state` JSON).
- 게이트웨이 에러 이벤트 이름(`party:error`) 등 소켓 이벤트 개명 금지.
- expo 패키지 추가는 `npx expo install`(SDK 56 호환 버전 자동 선택).
- 커밋 메시지는 한국어 conventional commit(기존 로그 스타일), 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: shared `PARTY_MAP` — 맵 단일 진실 + 무결성 테스트

**Files:**
- Create: `packages/shared/src/party-map/map.ts`
- Create: `packages/shared/src/party-map/map.test.ts`
- Modify: `packages/shared/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: 없음 (최초 태스크)
- Produces (이후 모든 태스크가 사용):
  - `WORLD_ASPECT = 1.9`, `CHAR_R = 0.035`(world 단위), `ROOM_MARGIN = 0.06`, `BALANCE_STATION_ID = "st-dj"`
  - `type FurnitureKind`, `interface FurnitureDef { id; kind; x; y; w; h }`(정규화 AABB), `interface StationDef { id; x; y; furnitureId }`, `interface PartyMapDef`
  - `const PARTY_MAP: PartyMapDef`
  - `isSolid(kind: FurnitureKind): boolean`, `solidFurniture(map?: PartyMapDef): FurnitureDef[]`

- [ ] **Step 1: 실패하는 무결성 테스트 작성**

`packages/shared/src/party-map/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PARTY_MAP,
  WORLD_ASPECT,
  CHAR_R,
  ROOM_MARGIN,
  BALANCE_STATION_ID,
  isSolid,
  solidFurniture,
  type FurnitureDef,
} from "./map.js";

/** world 좌표(x×aspect, y)에서 점→AABB 최단거리. */
function pointRectDistWorld(px: number, py: number, f: FurnitureDef): number {
  const wx = px * WORLD_ASPECT;
  const wy = py;
  const x1 = f.x * WORLD_ASPECT;
  const x2 = (f.x + f.w) * WORLD_ASPECT;
  const y1 = f.y;
  const y2 = f.y + f.h;
  const dx = Math.max(x1 - wx, 0, wx - x2);
  const dy = Math.max(y1 - wy, 0, wy - y2);
  return Math.hypot(dx, dy);
}

function rectsOverlap(a: { x1: number; y1: number; x2: number; y2: number }, f: FurnitureDef) {
  return a.x1 < f.x + f.w && a.x2 > f.x && a.y1 < f.y + f.h && a.y2 > f.y;
}

describe("PARTY_MAP integrity", () => {
  const solids = solidFurniture();

  it("aspect/CHAR_R/margin 상수가 계약값이다", () => {
    expect(WORLD_ASPECT).toBe(1.9);
    expect(CHAR_R).toBe(0.035);
    expect(ROOM_MARGIN).toBe(0.06);
  });

  it("가구 id는 유일하고 AABB는 방(0..1) 안에 있다", () => {
    const ids = PARTY_MAP.furniture.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of PARTY_MAP.furniture) {
      expect(f.w).toBeGreaterThan(0);
      expect(f.h).toBeGreaterThan(0);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(1);
      expect(f.y + f.h).toBeLessThanOrEqual(1);
    }
  });

  it("rug/stage만 통행 가능, 나머지는 solid", () => {
    expect(isSolid("rug")).toBe(false);
    expect(isSolid("stage")).toBe(false);
    for (const kind of ["bar", "table", "sofa", "dj", "plant"] as const) {
      expect(isSolid(kind)).toBe(true);
    }
    expect(solids.every((f) => isSolid(f.kind))).toBe(true);
  });

  it("스테이션은 8개 이상, id 유일, 실존 가구 참조, margin 안쪽", () => {
    expect(PARTY_MAP.stations.length).toBeGreaterThanOrEqual(8);
    const ids = PARTY_MAP.stations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const furnitureIds = new Set(PARTY_MAP.furniture.map((f) => f.id));
    for (const s of PARTY_MAP.stations) {
      expect(furnitureIds.has(s.furnitureId)).toBe(true);
      expect(s.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
      expect(s.x).toBeLessThanOrEqual(1 - ROOM_MARGIN);
      expect(s.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
      expect(s.y).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    }
  });

  it("모든 스테이션 앵커는 solid 가구에서 CHAR_R 이상 떨어져 서 있을 수 있다", () => {
    for (const s of PARTY_MAP.stations) {
      for (const f of solids) {
        expect(pointRectDistWorld(s.x, s.y, f)).toBeGreaterThanOrEqual(CHAR_R);
      }
    }
  });

  it("밸런스 스테이션(st-dj)이 존재한다", () => {
    expect(PARTY_MAP.stations.some((s) => s.id === BALANCE_STATION_ID)).toBe(true);
  });

  it("spawnZone은 margin 안쪽이고 solid 가구와 겹치지 않는다(CHAR_R 확장 포함)", () => {
    const z = PARTY_MAP.spawnZone;
    const rx = CHAR_R / WORLD_ASPECT; // world 반지름의 x축 정규화 환산
    expect(z.x - rx).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(z.x + z.w + rx).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    expect(z.y - CHAR_R).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(z.y + z.h + CHAR_R).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    const expanded = { x1: z.x - rx, y1: z.y - CHAR_R, x2: z.x + z.w + rx, y2: z.y + z.h + CHAR_R };
    for (const f of solids) {
      expect(rectsOverlap(expanded, f)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @mingle/shared test`
Expected: FAIL — `Cannot find module './map.js'`

- [ ] **Step 3: `map.ts` 구현**

`packages/shared/src/party-map/map.ts`:

```ts
/**
 * PARTY_MAP — 파티장 맵의 단일 진실(single source of truth).
 * 모바일 클라이언트(렌더·충돌)와 백엔드(어몽 태스크 배치)가 공유한다.
 *
 * 좌표계: 방은 정규화 [0,1]² 이되, 렌더·거리·충돌은 "world 계량"을 쓴다 —
 * world 좌표 = (x × WORLD_ASPECT, y). 즉 세로(높이)가 1 world 단위.
 * 화면에는 WORLD_ASPECT 비율로 aspect-fit(레터박스)되어 픽셀 스케일이 등방이 된다.
 */

export const WORLD_ASPECT = 1.9;
/** 캐릭터 충돌 반지름 (world 단위 = 방 높이 기준). */
export const CHAR_R = 0.035;
/** 방 가장자리 여백 (정규화, 양 축 동일 — 기존 party-space 값 이관). */
export const ROOM_MARGIN = 0.06;
/** 로비 밸런스 게임 스테이션 id (DJ 부스 앞). */
export const BALANCE_STATION_ID = "st-dj";

export type FurnitureKind = "bar" | "table" | "sofa" | "stage" | "dj" | "plant" | "rug";

/** 정규화 좌표 AABB. */
export interface FurnitureDef {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 태스크/상호작용 스테이션 앵커 — 통행 가능 지점(가구 인접). */
export interface StationDef {
  id: string;
  x: number;
  y: number;
  furnitureId: string;
}

export interface PartyMapDef {
  aspect: number;
  furniture: readonly FurnitureDef[];
  stations: readonly StationDef[];
  /** 가구 없는 스폰 영역(댄스플로어) — 정규화 rect. */
  spawnZone: { x: number; y: number; w: number; h: number };
}

const WALKABLE_KINDS: ReadonlySet<FurnitureKind> = new Set(["rug", "stage"]);

export function isSolid(kind: FurnitureKind): boolean {
  return !WALKABLE_KINDS.has(kind);
}

export function solidFurniture(map: PartyMapDef = PARTY_MAP): FurnitureDef[] {
  return map.furniture.filter((f) => isSolid(f.kind));
}

export const PARTY_MAP: PartyMapDef = {
  aspect: WORLD_ASPECT,
  furniture: [
    // 좌상: 바 카운터
    { id: "bar", kind: "bar", x: 0.08, y: 0.1, w: 0.18, h: 0.1 },
    // 좌중: 화분
    { id: "plant-a", kind: "plant", x: 0.08, y: 0.42, w: 0.05, h: 0.09 },
    // 좌하: 소파
    { id: "sofa", kind: "sofa", x: 0.08, y: 0.72, w: 0.16, h: 0.1 },
    // 우상: 무대(통행 가능) 위 DJ 부스(solid)
    { id: "stage", kind: "stage", x: 0.74, y: 0.1, w: 0.18, h: 0.22 },
    { id: "dj", kind: "dj", x: 0.78, y: 0.12, w: 0.1, h: 0.08 },
    // 중앙 하단: 라운드 테이블 2개
    { id: "table-1", kind: "table", x: 0.34, y: 0.62, w: 0.09, h: 0.14 },
    { id: "table-2", kind: "table", x: 0.57, y: 0.62, w: 0.09, h: 0.14 },
    // 우하: 화분
    { id: "plant-b", kind: "plant", x: 0.87, y: 0.76, w: 0.05, h: 0.09 },
    // 중앙: 댄스플로어 러그(통행 가능 장식)
    { id: "rug", kind: "rug", x: 0.36, y: 0.22, w: 0.28, h: 0.32 },
  ],
  stations: [
    { id: "st-bar", x: 0.17, y: 0.26, furnitureId: "bar" },
    { id: "st-plant-a", x: 0.17, y: 0.46, furnitureId: "plant-a" },
    { id: "st-sofa", x: 0.16, y: 0.66, furnitureId: "sofa" },
    { id: "st-table-1", x: 0.385, y: 0.56, furnitureId: "table-1" },
    { id: "st-table-2", x: 0.615, y: 0.56, furnitureId: "table-2" },
    { id: "st-dj", x: 0.73, y: 0.17, furnitureId: "dj" },
    { id: "st-stage", x: 0.83, y: 0.38, furnitureId: "stage" },
    { id: "st-plant-b", x: 0.84, y: 0.72, furnitureId: "plant-b" },
  ],
  spawnZone: { x: 0.4, y: 0.26, w: 0.2, h: 0.24 },
};
```

- [ ] **Step 4: index export 추가**

`packages/shared/src/index.ts` 끝에:

```ts
export {
  PARTY_MAP,
  WORLD_ASPECT,
  CHAR_R,
  ROOM_MARGIN,
  BALANCE_STATION_ID,
  isSolid,
  solidFurniture,
} from "./party-map/map.js";
export type { FurnitureKind, FurnitureDef, StationDef, PartyMapDef } from "./party-map/map.js";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @mingle/shared test`
Expected: PASS (기존 score/pair 테스트 포함 전부 그린). 좌표가 무결성 테스트에 걸리면 **데이터 좌표를 수정**(테스트 완화 금지).

- [ ] **Step 6: shared 빌드**

Run: `pnpm --filter @mingle/shared build`
Expected: 성공, `dist/` + `dist/cjs/` 갱신.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/party-map packages/shared/src/index.ts
git commit -m "feat(shared): PARTY_MAP 파티장 맵 데이터 + 무결성 테스트"
```

---

### Task 2: backend — 어몽 태스크 좌표를 스테이션 앵커로 배치

**Files:**
- Modify: `apps/backend/src/party/among.service.ts` (start()의 태스크 생성 ~L116, `randomInRoom` ~L729)
- Test: `apps/backend/src/party/among.service.spec.ts` (`describe("start")` 내부)

**Interfaces:**
- Consumes: Task 1의 `PARTY_MAP`, `StationDef` (`@mingle/shared`)
- Produces: 태스크 `{x,y}` ∈ 스테이션 앵커 집합 (클라 렌더가 가구 옆 마커로 신뢰)

- [ ] **Step 1: 실패하는 테스트 작성**

`among.service.spec.ts`의 `describe("start")` 블록 안, 기존 "4-player game" 테스트 아래에 추가:

```ts
import { PARTY_MAP } from "@mingle/shared"; // 파일 상단 import 블록에 추가

it("태스크 좌표는 전부 PARTY_MAP 스테이션 앵커에서 나온다", async () => {
  gameSession.findFirst.mockResolvedValue(null);
  profile.findMany.mockResolvedValue(profileNames(4));
  gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

  const state = await service.start("pt1", roster(4));

  const anchors = new Set(PARTY_MAP.stations.map((s) => `${s.x},${s.y}`));
  for (const t of state.tasks) {
    expect(anchors.has(`${t.x},${t.y}`)).toBe(true);
  }
  // 셔플 배정이므로 최소 2개 이상의 서로 다른 스테이션을 쓴다 (9 tasks / 8 stations)
  const used = new Set(state.tasks.map((t) => `${t.x},${t.y}`));
  expect(used.size).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @mingle/backend test -- among.service.spec`
Expected: FAIL — 랜덤 좌표가 앵커 집합에 없음.

- [ ] **Step 3: 구현**

`among.service.ts`:

1. 상단 import에 추가: `import { PARTY_MAP } from "@mingle/shared";`
2. 태스크 생성 블록(L112 근처) 교체:

```ts
        // Build tasks: each crew player gets cfg.tasksPerCrew tasks,
        // placed on shuffled PARTY_MAP station anchors (round-robin if tasks > stations).
        const stationPool = shuffle([...PARTY_MAP.stations]);
        const tasks: AmongState["tasks"] = [];
        let taskCounter = 0;
        for (const player of players) {
          if (player.role !== "crew") continue;
          for (let i = 0; i < cfg.tasksPerCrew; i++) {
            const station = stationPool[taskCounter % stationPool.length]!;
            tasks.push({
              taskId: `${player.profileId}:${i}`,
              profileId: player.profileId,
              kind: KINDS[taskCounter % 4]!,
              x: station.x,
              y: station.y,
              done: false,
            });
            taskCounter++;
          }
        }
```

3. 파일 하단 `randomInRoom()` 함수 삭제 (사용처 0 확인: `grep -n randomInRoom apps/backend/src -r`).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @mingle/backend test -- among.service.spec`
Expected: PASS — 신규 테스트 + 기존 start/doTask/kill 스위트 전부.

- [ ] **Step 5: backend 전체 스위트 + 빌드 확인**

Run: `pnpm --filter @mingle/backend test` 그리고 `pnpm --filter @mingle/backend build`
Expected: 테스트 전부 PASS, 빌드 성공 (`"Found N error"` 문자열로 TS 에러 grep — ANSI 때문에 `error TS` grep은 0 나옴).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/party/among.service.ts apps/backend/src/party/among.service.spec.ts
git commit -m "feat(backend): 어몽 태스크 좌표를 PARTY_MAP 스테이션 앵커로 배치"
```

---

### Task 3: mobile `party-space.ts` — world 계량 + 충돌 이동 + 스폰존

**Files:**
- Modify: `apps/mobile/src/lib/party-space.ts`
- Test: `apps/mobile/src/lib/__tests__/party-space.test.ts`

**Interfaces:**
- Consumes: Task 1의 `PARTY_MAP`, `WORLD_ASPECT`, `CHAR_R`, `ROOM_MARGIN`, `solidFurniture`, `FurnitureDef`
- Produces (파티 화면·AmongGame·PartyWorld가 사용):
  - `worldDist(a: Vec2, b: Vec2): number` — world 계량 거리
  - `moveWithCollision(pos: Vec2, vel: Vec2, dtMs: number, rects?: readonly WorldRect[]): Vec2`
  - `toWorldRects(furniture: readonly FurnitureDef[]): WorldRect[]`, `interface WorldRect { x1; y1; x2; y2 }`
  - `MOVE_SPEED = 0.45`(world/s, 풀틸트), `INTERACT_RANGE = 0.14`(world), `MAX_STEP_DT_MS = 50`
  - 기존 시그니처 유지: `clampToRoom`, `stepToward`(내부만 world 계량화), `shouldEmit`, `spawnFor`(스폰존 매핑), `initialOf`, `Vec2`
  - re-export: `ROOM_MARGIN`, `WORLD_ASPECT`, `CHAR_R`

- [ ] **Step 1: 실패하는 테스트 작성 — 기존 테스트 갱신 + 신규 케이스**

`party-space.test.ts` 전체를 다음으로 교체:

```ts
import { describe, it, expect } from "vitest";
import { PARTY_MAP, WORLD_ASPECT } from "@mingle/shared";
import {
  clampToRoom,
  stepToward,
  shouldEmit,
  spawnFor,
  initialOf,
  worldDist,
  moveWithCollision,
  toWorldRects,
  ROOM_MARGIN,
  EMIT_MIN_INTERVAL_MS,
  MOVE_SPEED,
} from "../party-space";

describe("clampToRoom", () => {
  it("clamps both axes into the margin-inset unit square", () => {
    expect(clampToRoom({ x: -1, y: 2 })).toEqual({
      x: ROOM_MARGIN,
      y: 1 - ROOM_MARGIN,
    });
    expect(clampToRoom({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("worldDist", () => {
  it("y축 이동은 그대로, x축 이동은 aspect 배로 잰다", () => {
    expect(worldDist({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.1, 10);
    expect(worldDist({ x: 0.2, y: 0.5 }, { x: 0.3, y: 0.5 })).toBeCloseTo(0.1 * WORLD_ASPECT, 10);
  });
});

describe("stepToward (world 계량)", () => {
  it("x축 목표를 향해 world 스텝만큼 이동 — 정규화로는 aspect로 나눠 짧아진다", () => {
    const next = stepToward({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 100);
    expect(next.x).toBeCloseTo((MOVE_SPEED * 0.1) / WORLD_ASPECT, 5);
    expect(next.y).toBeCloseTo(0.5, 5);
  });
  it("snaps onto the target when closer than one step", () => {
    expect(stepToward({ x: 0.999, y: 0.5 }, { x: 1, y: 0.5 }, 100)).toEqual({ x: 1, y: 0.5 });
  });
  it("is stationary at the target", () => {
    expect(stepToward({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }, 16)).toEqual({ x: 0.3, y: 0.3 });
  });
});

describe("moveWithCollision", () => {
  // 방 중앙에 정사각(world 기준) 장애물: x 0.4~0.5(norm), y 0.4~0.59
  const RECTS = toWorldRects([{ id: "t", kind: "table", x: 0.4, y: 0.4, w: 0.1, h: 0.19 }]);

  it("vel 0이면 제자리", () => {
    const p = { x: 0.5, y: 0.5 };
    expect(moveWithCollision(p, { x: 0, y: 0 }, 16, RECTS)).toBe(p);
  });

  it("장애물 없으면 world 스텝만큼 이동한다", () => {
    const next = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 1 }, 100, []);
    expect(next.y).toBeCloseTo(0.2 + MOVE_SPEED * 0.1, 5);
    expect(next.x).toBeCloseTo(0.5, 10);
  });

  it("스틱 반틸트는 절반 속도다", () => {
    const full = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 1 }, 100, []);
    const half = moveWithCollision({ x: 0.5, y: 0.2 }, { x: 0, y: 0.5 }, 100, []);
    expect(half.y - 0.2).toBeCloseTo((full.y - 0.2) / 2, 5);
  });

  it("벽에 대각으로 밀면 막힌 축만 멈추고 슬라이딩한다", () => {
    // 장애물 왼쪽에 붙어 서서(CHAR_R 확장 경계 바로 밖) 오른쪽+아래로 민다
    const startX = RECTS[0]!.x1 / WORLD_ASPECT - 1e-9;
    const start = { x: startX, y: 0.5 };
    const next = moveWithCollision(start, { x: 1, y: 1 }, 32, RECTS);
    expect(next.x * WORLD_ASPECT).toBeLessThanOrEqual(RECTS[0]!.x1 + 1e-9); // x는 경계에 고정
    expect(next.y).toBeGreaterThan(start.y); // y는 계속 진행
  });

  it("큰 dt(백그라운드 복귀)에도 얇은 벽을 관통하지 않는다", () => {
    const start = { x: 0.3, y: 0.5 };
    const next = moveWithCollision(start, { x: 1, y: 0 }, 5000, RECTS);
    expect(next.x * WORLD_ASPECT).toBeLessThanOrEqual(RECTS[0]!.x1 + 1e-9);
  });

  it("room margin 밖으로 나가지 않는다", () => {
    const next = moveWithCollision({ x: 0.07, y: 0.07 }, { x: -1, y: -1 }, 100, []);
    expect(next.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(next.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
  });
});

describe("shouldEmit", () => {
  it("always emits the first position", () => {
    expect(shouldEmit(null, 0, { x: 0.5, y: 0.5 }, 0)).toBe(true);
  });
  it("suppresses within the min interval", () => {
    expect(
      shouldEmit({ x: 0, y: 0 }, 1000, { x: 1, y: 1 }, 1000 + EMIT_MIN_INTERVAL_MS - 1),
    ).toBe(false);
  });
  it("suppresses sub-delta jitter even after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.5001, y: 0.5 }, 500)).toBe(false);
  });
  it("emits a real move after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.6, y: 0.5 }, 500)).toBe(true);
  });
});

describe("spawnFor", () => {
  it("결정적이고 spawnZone 안이다", () => {
    const z = PARTY_MAP.spawnZone;
    const a1 = spawnFor("profile-a");
    expect(spawnFor("profile-a")).toEqual(a1);
    expect(a1.x).toBeGreaterThanOrEqual(z.x);
    expect(a1.x).toBeLessThanOrEqual(z.x + z.w);
    expect(a1.y).toBeGreaterThanOrEqual(z.y);
    expect(a1.y).toBeLessThanOrEqual(z.y + z.h);
  });
  it("spreads different ids apart", () => {
    expect(spawnFor("profile-a")).not.toEqual(spawnFor("profile-b"));
  });
});

describe("initialOf", () => {
  it("returns the first character (hangul + latin)", () => {
    expect(initialOf("김철수")).toBe("김");
    expect(initialOf("Alice")).toBe("A");
  });
  it("falls back to ? for empty", () => {
    expect(initialOf("  ")).toBe("?");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- party-space`
Expected: FAIL — `worldDist`/`moveWithCollision`/`toWorldRects` 미정의, stepToward/spawnFor 기대값 불일치.

- [ ] **Step 3: `party-space.ts` 구현**

전체를 다음으로 교체:

```ts
import { PARTY_MAP, WORLD_ASPECT, CHAR_R, ROOM_MARGIN, solidFurniture } from "@mingle/shared";
import type { FurnitureDef } from "@mingle/shared";

export interface Vec2 {
  x: number;
  y: number;
}

export { ROOM_MARGIN, WORLD_ASPECT, CHAR_R };

/**
 * 좌표는 정규화 [0,1]²로 저장/전송하되(프로토콜 불변), 거리·속도·충돌은
 * world 계량으로 계산한다: world = (x × WORLD_ASPECT, y). 높이가 1 world 단위.
 * 화면은 WORLD_ASPECT로 aspect-fit 렌더되므로 world 계량 = 시각적 등방 거리.
 */
export const MOVE_SPEED = 0.45; // world units per second, 조이스틱 풀틸트 기준
export const EMIT_MIN_INTERVAL_MS = 100; // ≤10Hz network emits
export const EMIT_MIN_DELTA = 0.005; // normalized min movement to emit
/** 로비 상호작용(프로필/스테이션) 근접 반경, world 단위. */
export const INTERACT_RANGE = 0.14;
/** 충돌 적분 dt 클램프 — 백그라운드 복귀 등 dt 스파이크 시 터널링 방지. */
export const MAX_STEP_DT_MS = 50;

/** Clamp a point into the walkable room (margin-inset unit square). */
export function clampToRoom(p: Vec2): Vec2 {
  const clamp = (v: number) => Math.min(Math.max(v, ROOM_MARGIN), 1 - ROOM_MARGIN);
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** world 계량 유클리드 거리 — 모든 근접 판정(RANGE)은 이걸 쓴다. */
export function worldDist(a: Vec2, b: Vec2): number {
  return Math.hypot((b.x - a.x) * WORLD_ASPECT, b.y - a.y);
}

/** world 좌표 AABB (CHAR_R 민코프스키 확장 포함). */
export interface WorldRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 정규화 가구 AABB → CHAR_R 확장 world rect. */
export function toWorldRects(furniture: readonly FurnitureDef[]): WorldRect[] {
  return furniture.map((f) => ({
    x1: f.x * WORLD_ASPECT - CHAR_R,
    y1: f.y - CHAR_R,
    x2: (f.x + f.w) * WORLD_ASPECT + CHAR_R,
    y2: f.y + f.h + CHAR_R,
  }));
}

const SOLID_WORLD: readonly WorldRect[] = toWorldRects(solidFurniture());

/**
 * 조이스틱 속도 적분 + 축분리 충돌 해소(x 이동→해소, y 이동→해소 = 벽 슬라이딩).
 * vel은 크기 ≤1의 방향 벡터(조이스틱 출력). 반환은 정규화 좌표.
 */
export function moveWithCollision(
  pos: Vec2,
  vel: Vec2,
  dtMs: number,
  rects: readonly WorldRect[] = SOLID_WORLD,
): Vec2 {
  const mag = Math.hypot(vel.x, vel.y);
  if (mag === 0) return pos;
  const step = MOVE_SPEED * Math.min(mag, 1) * (Math.min(dtMs, MAX_STEP_DT_MS) / 1000);
  const nx = vel.x / mag;
  const ny = vel.y / mag;
  let wx = pos.x * WORLD_ASPECT;
  let wy = pos.y;
  wx += nx * step;
  for (const r of rects) {
    if (wx > r.x1 && wx < r.x2 && wy > r.y1 && wy < r.y2) wx = nx > 0 ? r.x1 : r.x2;
  }
  wy += ny * step;
  for (const r of rects) {
    if (wx > r.x1 && wx < r.x2 && wy > r.y1 && wy < r.y2) wy = ny > 0 ? r.y1 : r.y2;
  }
  return clampToRoom({ x: wx / WORLD_ASPECT, y: wy });
}

/** 원격 피어 스무딩: 목표점을 향한 world-속도 등속 이동, 한 스텝 이내면 스냅. */
export function stepToward(current: Vec2, target: Vec2, dtMs: number): Vec2 {
  const dx = (target.x - current.x) * WORLD_ASPECT;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = MOVE_SPEED * (dtMs / 1000);
  if (dist === 0 || dist <= step) return { x: target.x, y: target.y };
  return {
    x: current.x + ((dx / dist) * step) / WORLD_ASPECT,
    y: current.y + (dy / dist) * step,
  };
}

/** Throttle gate for network emits: min interval AND min distance. */
export function shouldEmit(
  lastSent: Vec2 | null,
  lastSentAtMs: number,
  next: Vec2,
  nowMs: number,
): boolean {
  if (!lastSent) return true;
  if (nowMs - lastSentAtMs < EMIT_MIN_INTERVAL_MS) return false;
  return Math.hypot(next.x - lastSent.x, next.y - lastSent.y) >= EMIT_MIN_DELTA;
}

/** Deterministic spawn point from a profileId — 가구 없는 spawnZone 안에 뿌린다. */
export function spawnFor(profileId: string): Vec2 {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (h % 1000) / 1000;
  const gy = (Math.floor(h / 1000) % 1000) / 1000;
  const z = PARTY_MAP.spawnZone;
  return { x: z.x + gx * z.w, y: z.y + gy * z.h };
}

/** First grapheme-ish initial for the avatar label. */
export function initialOf(name: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? [...trimmed][0]! : "?";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @mingle/mobile test -- party-space`
Expected: PASS 전부.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/party-space.ts apps/mobile/src/lib/__tests__/party-space.test.ts
git commit -m "feat(mobile): party-space world 계량 + 축분리 충돌 이동 + 스폰존"
```

---

### Task 4: mobile `among.ts` — 거리 판정 world 계량 전환

**Files:**
- Modify: `apps/mobile/src/lib/among.ts`
- Test: `apps/mobile/src/lib/__tests__/among.test.ts`

**Interfaces:**
- Consumes: Task 3의 `worldDist`
- Produces: `RANGE = { task: 0.1, kill: 0.12 }`(값 유지, 계량만 world), `dist` = `worldDist` 별칭. `nearestTask`/`nearestKillTarget`/`nearbyBody` 시그니처 불변.

- [ ] **Step 1: 테스트 갱신 (실패 상태로)**

`among.test.ts`에서 다음 3가지를 수정:

1. `describe("dist")`의 3-4-5 테스트 교체:

```ts
  it("world 계량이다 — x는 aspect 배, y는 그대로", () => {
    expect(dist({ x: 0, y: 0 }, { x: 0.3, y: 0.4 })).toBeCloseTo(Math.hypot(0.3 * 1.9, 0.4), 10);
    expect(dist({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })).toBeCloseTo(0.1, 10);
  });
```

2. 등거리(deterministic) 테스트 3곳 — 동쪽 점의 x 오프셋을 world 기준 0.04가 되도록 `0.04 / 1.9`로 교체:

```ts
  // nearestTask
  const t1 = task("t1", 0.04 / 1.9, 0); // east, world 0.04 away
  const t2 = task("t2", 0, 0.04); // south, world 0.04 away
  // nearestKillTarget
  p1: { x: 0.04 / 1.9, y: 0 },
  p2: { x: 0, y: 0.04 },
  // nearbyBody
  const b1 = body("b1", 0.04 / 1.9, 0);
  const b2 = body("b2", 0, 0.04);
```

3. 신규 회귀 테스트 추가 (`describe("nearestTask")` 안):

```ts
  it("x 오프셋은 world 계량으로 재서 판정한다 (정규화 0.06 = world 0.114 > range)", () => {
    const tasks = [task("tx", 0.06, 0)];
    expect(nearestTask({ x: 0, y: 0 }, tasks, RANGE.task)).toBeNull();
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- among`
Expected: FAIL — dist가 아직 정규화 유클리드.

- [ ] **Step 3: 구현 — `among.ts`의 dist를 worldDist 별칭으로**

`among.ts` 상단부 교체:

```ts
import type { Vec2 } from "./party-space";
import { worldDist } from "./party-space";
import type { AmongTaskView, AmongPlayerView, AmongBodyView } from "@mingle/shared";

/** Proximity thresholds — world 계량(방 높이=1) 기준. */
export const RANGE = { task: 0.1, kill: 0.12 } as const;

/** world 계량 거리(= party-space.worldDist). 시각 원형과 판정 원형이 일치한다. */
export const dist = worldDist;
```

(`function dist(...)` 본문 삭제. `nearestTask` 등 나머지는 그대로 — 내부에서 `dist` 사용 유지.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @mingle/mobile test`
Expected: mobile vitest 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/among.ts apps/mobile/src/lib/__tests__/among.test.ts
git commit -m "feat(mobile): 어몽 근접 판정을 world 계량으로 — 시각 거리와 일치"
```

---

### Task 5: 조이스틱 — 순수 로직 + 컴포넌트

**Files:**
- Create: `apps/mobile/src/lib/joystick.ts`
- Create: `apps/mobile/src/lib/__tests__/joystick.test.ts`
- Create: `apps/mobile/src/components/party/Joystick.tsx`

**Interfaces:**
- Consumes: `Vec2`(party-space), `wobbleRect`(doodle-path), `colors`(theme)
- Produces:
  - `stickVector(dx, dy, radius?): Vec2` — 제스처 px 오프셋 → 크기 ≤1 속도 벡터(데드존 0.15)
  - `knobOffset(dx, dy, radius?): Vec2` — 노브 비주얼 오프셋(베이스 원 클램프)
  - `STICK_RADIUS = 44`, `STICK_DEAD_ZONE = 0.15`
  - `<Joystick onVector={(v: Vec2) => void} style?/>` — 파티 화면이 velRef에 기록

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/mobile/src/lib/__tests__/joystick.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stickVector, knobOffset, STICK_RADIUS, STICK_DEAD_ZONE } from "../joystick";

describe("stickVector", () => {
  it("반경 0 이하 방어", () => {
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });
  it("데드존 안은 0 벡터", () => {
    const inside = STICK_RADIUS * (STICK_DEAD_ZONE - 0.01);
    expect(stickVector(inside, 0)).toEqual({ x: 0, y: 0 });
  });
  it("데드존 밖 중간 틸트는 비례 벡터", () => {
    const v = stickVector(STICK_RADIUS * 0.5, 0);
    expect(v.x).toBeCloseTo(0.5, 10);
    expect(v.y).toBe(0);
  });
  it("반경 초과 드래그는 크기 1로 클램프", () => {
    const v = stickVector(STICK_RADIUS * 3, STICK_RADIUS * 4);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 10);
    expect(v.x / v.y).toBeCloseTo(3 / 4, 10);
  });
});

describe("knobOffset", () => {
  it("반경 안은 그대로", () => {
    expect(knobOffset(10, -5)).toEqual({ x: 10, y: -5 });
  });
  it("반경 밖은 원둘레로 클램프", () => {
    const o = knobOffset(STICK_RADIUS * 3, STICK_RADIUS * 4);
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(STICK_RADIUS, 10);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @mingle/mobile test -- joystick`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `joystick.ts` 구현**

```ts
import type { Vec2 } from "./party-space";

/** 노브 이동 반경(px). 베이스 지름 = STICK_RADIUS*2 + 패딩. */
export const STICK_RADIUS = 44;
/** 이 비율 미만의 틸트는 무시(손떨림 방지). */
export const STICK_DEAD_ZONE = 0.15;

/** 제스처 오프셋(px, grant 기준) → 크기 ≤1 속도 벡터. */
export function stickVector(dx: number, dy: number, radius: number = STICK_RADIUS): Vec2 {
  if (radius <= 0) return { x: 0, y: 0 };
  let vx = dx / radius;
  let vy = dy / radius;
  const mag = Math.hypot(vx, vy);
  if (mag < STICK_DEAD_ZONE) return { x: 0, y: 0 };
  if (mag > 1) {
    vx /= mag;
    vy /= mag;
  }
  return { x: vx, y: vy };
}

/** 노브 비주얼 오프셋 — 베이스 원 안으로 클램프. */
export function knobOffset(dx: number, dy: number, radius: number = STICK_RADIUS): Vec2 {
  const mag = Math.hypot(dx, dy);
  if (mag <= radius) return { x: dx, y: dy };
  return { x: (dx / mag) * radius, y: (dy / mag) * radius };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @mingle/mobile test -- joystick`
Expected: PASS.

- [ ] **Step 5: `Joystick.tsx` 구현**

`apps/mobile/src/components/party/Joystick.tsx`:

```tsx
/**
 * Joystick — 좌하단 고정 가상 스틱. PanResponder(dx/dy는 grant 기준)라서
 * RN Web에서도 동작한다(locationX 불사용). grant 지점을 스틱 중심으로 취급하는
 * "고정 베이스 + 마이크로 플로팅" 방식 — 베이스 어디를 눌러도 그 지점이 기준.
 * 이동은 onVector로만 나간다(부모 velRef → rAF 적분). 노브 상태는 로컬 렌더 전용.
 */
import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { wobbleRect } from "../../lib/doodle-path";
import { stickVector, knobOffset, STICK_RADIUS } from "../../lib/joystick";
import type { Vec2 } from "../../lib/party-space";
import { colors } from "../../lib/theme";

const BASE = STICK_RADIUS * 2 + 32; // 120
const KNOB = 48;
const round = (r: number) => ({
  borderTopLeftRadius: r,
  borderTopRightRadius: r,
  borderBottomRightRadius: r,
  borderBottomLeftRadius: r,
});
const BASE_PATH = wobbleRect(BASE - 4, BASE - 4, round((BASE - 4) / 2), 11, { amp: 1.4, step: 10 });
const KNOB_PATH = wobbleRect(KNOB - 4, KNOB - 4, round((KNOB - 4) / 2), 23, { amp: 1.1, step: 8 });

export function Joystick({
  onVector,
  style,
}: {
  onVector: (v: Vec2) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [knob, setKnob] = useState<Vec2>({ x: 0, y: 0 });
  const onVectorRef = useRef(onVector);
  onVectorRef.current = onVector;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => {
          onVectorRef.current(stickVector(g.dx, g.dy));
          setKnob(knobOffset(g.dx, g.dy));
        },
        onPanResponderRelease: () => {
          onVectorRef.current({ x: 0, y: 0 });
          setKnob({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          onVectorRef.current({ x: 0, y: 0 });
          setKnob({ x: 0, y: 0 });
        },
      }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      style={[styles.base, style]}
      accessibilityLabel="이동 조이스틱"
    >
      <Svg width={BASE} height={BASE} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          d={BASE_PATH}
          x={2}
          y={2}
          fill="rgba(255,255,255,0.35)"
          stroke={colors.ink}
          strokeWidth={2}
          opacity={0.55}
        />
      </Svg>
      <View
        pointerEvents="none"
        style={[styles.knob, { transform: [{ translateX: knob.x }, { translateY: knob.y }] }]}
      >
        <Svg width={KNOB} height={KNOB}>
          <Path d={KNOB_PATH} x={2} y={2} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: BASE,
    height: BASE,
    alignItems: "center",
    justifyContent: "center",
  },
  knob: { width: KNOB, height: KNOB },
});
```

- [ ] **Step 6: tsc 확인**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/joystick.ts apps/mobile/src/lib/__tests__/joystick.test.ts apps/mobile/src/components/party/Joystick.tsx
git commit -m "feat(mobile): 가상 조이스틱 — 순수 벡터 로직 + PanResponder 컴포넌트"
```

---

### Task 6: 가로 방향 인프라 — expo-screen-orientation

**Files:**
- Modify: `apps/mobile/app.json` (`"orientation": "portrait"` → `"default"`)
- Modify: `apps/mobile/app/_layout.tsx` (루트 세로 고정)
- Create: `apps/mobile/src/lib/use-landscape.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `useLandscapeLock(): void` — mount 시 가로 lock, unmount 시 세로 복귀 (Task 10이 사용)

- [ ] **Step 1: 의존성 설치**

Run: `cd apps/mobile && npx expo install expo-screen-orientation`
Expected: package.json에 SDK 56 호환 버전 추가. (⚠️ `.npmrc` `node-linker=hoisted` 유지 — 설치 후 `git diff .npmrc`가 비어 있는지 확인.)

- [ ] **Step 2: app.json 방향 변경**

`"orientation": "portrait"` → `"orientation": "default"`.
(네이티브 빌드가 landscape를 지원해야 runtime lock이 동작. 세로 고정은 다음 스텝의 루트 lock이 담당.)

- [ ] **Step 3: 루트 세로 고정**

`app/_layout.tsx`:

```tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useFonts, Gaegu_400Regular, Gaegu_700Bold } from "@expo-google-fonts/gaegu";
import "../src/lib/client";
import { colors } from "../src/lib/theme";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Gaegu_400Regular, Gaegu_700Bold });

  // app.json orientation="default"(runtime lock을 위해 필요) 상태에서 앱 전역은 세로 고정.
  // 파티 화면만 useLandscapeLock으로 가로 전환. 웹은 미지원 — no-op.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
    />
  );
}
```

(기존 주석 유지 — 폰트 게이트 주석과 헤더 비표시 주석 삭제 금지.)

- [ ] **Step 4: `use-landscape.ts` 훅**

```ts
import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";

/**
 * 화면이 살아있는 동안 가로 고정, 벗어나면 세로 복귀.
 * 실패(웹 등 미지원)는 무시 — 레이아웃은 flex 기반이라 세로에서도 동작한다.
 */
export function useLandscapeLock() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
}
```

- [ ] **Step 5: tsc + 번들 스모크**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 에러 0.
Run: `pnpm --filter @mingle/mobile test`
Expected: PASS (훅은 테스트 밖 — node vitest에 RN 미포함 확인).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app.json apps/mobile/app/_layout.tsx apps/mobile/src/lib/use-landscape.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): expo-screen-orientation — 루트 세로 고정 + 가로 lock 훅"
```

---

### Task 7: `DoodleCharacter` — 두들 인형 캐릭터

**Files:**
- Create: `apps/mobile/src/components/party/DoodleCharacter.tsx`

**Interfaces:**
- Consumes: `wobbleRect`/`mulberry`(doodle-path), `colors`/`fonts`(theme)
- Produces (PartyWorld가 사용):
  - `<DoodleCharacter name mine walking facing phase ghost? size? />` — `phase`: ms 클록(보빙·팔다리 스윙), `facing`: 1(우)|-1(좌), `size`: svg 높이 px(기본 44)
  - `<DoodleCorpse size? />` — 어몽 시체(누운 몸 + X 눈)
  - `CHAR_BOX = { w: 0.62, h: 1.3 }` — size 대비 폭/전체높이 배율(배치 계산용)

- [ ] **Step 1: 구현**

```tsx
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
```

- [ ] **Step 2: tsc 확인 + Commit**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.

```bash
git add apps/mobile/src/components/party/DoodleCharacter.tsx
git commit -m "feat(mobile): DoodleCharacter — 두들 인형 캐릭터(걷기 스윙·유령·시체)"
```

---

### Task 8: `PartyMapArt` + `world-view` — 맵 렌더와 aspect-fit

**Files:**
- Create: `apps/mobile/src/lib/world-view.ts`
- Create: `apps/mobile/src/lib/__tests__/world-view.test.ts`
- Create: `apps/mobile/src/components/party/PartyMapArt.tsx`

**Interfaces:**
- Consumes: `PARTY_MAP`/`WORLD_ASPECT`/`FurnitureDef`(shared), `wobbleRect`(doodle-path)
- Produces:
  - `worldFrame(containerW, containerH, aspect?): { left; top; width; height }` — 레터박스 프레임(PartyWorld 사용)
  - `<PartyMapArt width height />` — 프레임 px 크기를 받아 가구 전체를 그리는 정적(memo) SVG

- [ ] **Step 1: 실패하는 테스트 작성**

`world-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { worldFrame } from "../world-view";

describe("worldFrame", () => {
  it("납작한 컨테이너: 높이 제한, 가로 중앙 정렬", () => {
    const f = worldFrame(2000, 500, 1.9);
    expect(f.height).toBe(500);
    expect(f.width).toBeCloseTo(950, 6);
    expect(f.left).toBeCloseTo((2000 - 950) / 2, 6);
    expect(f.top).toBe(0);
  });
  it("길쭉한 컨테이너: 폭 제한, 세로 중앙 정렬", () => {
    const f = worldFrame(950, 900, 1.9);
    expect(f.width).toBe(950);
    expect(f.height).toBeCloseTo(500, 6);
    expect(f.top).toBeCloseTo(200, 6);
    expect(f.left).toBe(0);
  });
  it("0 이하 컨테이너 방어", () => {
    expect(worldFrame(0, 500)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현**

Run: `pnpm --filter @mingle/mobile test -- world-view` → FAIL 확인 후 `world-view.ts`:

```ts
import { WORLD_ASPECT } from "@mingle/shared";

export interface WorldFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 컨테이너에 aspect-fit(레터박스)한 월드 프레임. 픽셀 스케일이 등방이 된다. */
export function worldFrame(
  containerW: number,
  containerH: number,
  aspect: number = WORLD_ASPECT,
): WorldFrame {
  if (containerW <= 0 || containerH <= 0) return { left: 0, top: 0, width: 0, height: 0 };
  let width = containerW;
  let height = containerW / aspect;
  if (height > containerH) {
    height = containerH;
    width = containerH * aspect;
  }
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}
```

Run: `pnpm --filter @mingle/mobile test -- world-view` → PASS.

- [ ] **Step 3: `PartyMapArt.tsx` 구현**

```tsx
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
          <Line x1={w * 0.2} y1={h * 0.3} x2={w * 0.2} y2={h * 0.62} stroke={colors.ink} strokeWidth={2} />
          <Line x1={w * 0.45} y1={h * 0.24} x2={w * 0.45} y2={h * 0.62} stroke={colors.ink} strokeWidth={2} />
          <Line x1={w * 0.7} y1={h * 0.34} x2={w * 0.7} y2={h * 0.62} stroke={colors.ink} strokeWidth={2} />
          <Line x1={w * 0.1} y1={h * 0.72} x2={w * 0.9} y2={h * 0.72} stroke={colors.ink} strokeWidth={1.4} />
        </>
      )}
      {f.kind === "table" && (
        <Circle cx={w / 2} cy={h / 2} r={Math.min(w, h) * 0.22} stroke={colors.ink} strokeWidth={1.6} fill="none" />
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
          <Circle cx={w * 0.3} cy={h * 0.5} r={Math.min(w, h) * 0.2} stroke={colors.ink} strokeWidth={1.6} fill="none" />
          <Circle cx={w * 0.7} cy={h * 0.5} r={Math.min(w, h) * 0.2} stroke={colors.ink} strokeWidth={1.6} fill="none" />
        </>
      )}
      {f.kind === "plant" && (
        <>
          <Path d={`M${w / 2} ${h * 0.55} q${-w * 0.3} ${-h * 0.3} ${-w * 0.15} ${-h * 0.45}`} stroke={colors.ink} strokeWidth={1.6} fill="none" />
          <Path d={`M${w / 2} ${h * 0.55} q${w * 0.3} ${-h * 0.3} ${w * 0.15} ${-h * 0.45}`} stroke={colors.ink} strokeWidth={1.6} fill="none" />
          <Path d={`M${w / 2} ${h * 0.55} v${-h * 0.4}`} stroke={colors.ink} strokeWidth={1.6} fill="none" />
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
  const sorted = [...PARTY_MAP.furniture].sort((a, b) => Number(isSolid(a.kind)) - Number(isSolid(b.kind)));
  return (
    <Svg width={width} height={height} pointerEvents="none">
      {sorted.map((f) => (
        <FurniturePiece key={f.id} f={f} width={width} height={height} />
      ))}
    </Svg>
  );
});
```

- [ ] **Step 4: tsc + Commit**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.

```bash
git add apps/mobile/src/lib/world-view.ts apps/mobile/src/lib/__tests__/world-view.test.ts apps/mobile/src/components/party/PartyMapArt.tsx
git commit -m "feat(mobile): PartyMapArt 가구 두들 렌더 + worldFrame aspect-fit"
```

---

### Task 9: `PartyWorld` — 공용 월드 렌더러

**Files:**
- Create: `apps/mobile/src/components/party/PartyWorld.tsx`

**Interfaces:**
- Consumes: Task 7 `DoodleCharacter`/`DoodleCorpse`, Task 8 `worldFrame`/`PartyMapArt`, shared `PARTY_MAP`/`BALANCE_STATION_ID`
- Produces (파티 화면·AmongGame이 사용):

```ts
export interface WorldCharacter {
  profileId: string;
  name: string;
  pos: Vec2;         // normalized
  mine: boolean;
  walking: boolean;
  facing: 1 | -1;
  ghost?: boolean;   // among 사망자
}
// props
{
  characters: WorldCharacter[];
  bodies?: { profileId: string; x: number; y: number }[];
  taskMarkers?: { id: string; x: number; y: number }[]; // 내 미완료 태스크
  showBalanceStation?: boolean; // 로비 전용 — st-dj 앵커에 코랄 마커
  clock: number; // ms — 보빙 phase
}
```

- [ ] **Step 1: 구현**

```tsx
/**
 * PartyWorld — 로비·어몽 공용 2D 월드. 컨테이너를 재고 worldFrame으로
 * 레터박스한 뒤 맵 아트/마커/시체/캐릭터를 절대배치한다. 캐릭터는 y 오름차순
 * 페인터 정렬(아래 있는 캐릭터가 앞). 입력(조이스틱/액션패드)은 부모 소관.
 */
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { PARTY_MAP, BALANCE_STATION_ID } from "@mingle/shared";
import type { Vec2 } from "../../lib/party-space";
import { worldFrame } from "../../lib/world-view";
import { colors } from "../../lib/theme";
import { DoodleCharacter, DoodleCorpse, CHAR_BOX } from "./DoodleCharacter";
import { PartyMapArt } from "./PartyMapArt";

export interface WorldCharacter {
  profileId: string;
  name: string;
  pos: Vec2;
  mine: boolean;
  walking: boolean;
  facing: 1 | -1;
  ghost?: boolean;
}

const TASK_MARKER = 16;

export function PartyWorld({
  characters,
  bodies = [],
  taskMarkers = [],
  showBalanceStation = false,
  clock,
  children,
}: {
  characters: WorldCharacter[];
  bodies?: { profileId: string; x: number; y: number }[];
  taskMarkers?: { id: string; x: number; y: number }[];
  showBalanceStation?: boolean;
  clock: number;
  children?: ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const frame = worldFrame(box.w, box.h);
  const charSize = Math.min(56, Math.max(34, frame.height * 0.12));
  const balance = PARTY_MAP.stations.find((s) => s.id === BALANCE_STATION_ID)!;
  const sorted = [...characters].sort((a, b) => a.pos.y - b.pos.y);

  return (
    <View
      style={styles.letterbox}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {frame.width > 0 ? (
        <View
          style={[
            styles.floor,
            { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
          ]}
        >
          <PartyMapArt width={frame.width} height={frame.height} />

          {showBalanceStation ? (
            <View
              pointerEvents="none"
              style={[
                styles.balanceMarker,
                {
                  left: balance.x * frame.width - 7,
                  top: balance.y * frame.height - 7,
                },
              ]}
            />
          ) : null}

          {taskMarkers.map((t) => (
            <View
              key={t.id}
              pointerEvents="none"
              style={[
                styles.taskMarker,
                {
                  left: t.x * frame.width - TASK_MARKER / 2,
                  top: t.y * frame.height - TASK_MARKER / 2,
                },
              ]}
            />
          ))}

          {bodies.map((b) => (
            <View
              key={b.profileId}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: b.x * frame.width - 20,
                top: b.y * frame.height - 16,
              }}
            >
              <DoodleCorpse />
            </View>
          ))}

          {sorted.map((c) => (
            <View
              key={c.profileId}
              pointerEvents="none"
              style={{
                position: "absolute",
                // 발끝(pos)이 캐릭터 하단 중앙에 오도록 오프셋
                left: c.pos.x * frame.width - (charSize * CHAR_BOX.w) / 2,
                top: c.pos.y * frame.height - charSize * CHAR_BOX.h + charSize * 0.12,
              }}
            >
              <DoodleCharacter
                name={c.name}
                mine={c.mine}
                walking={c.walking}
                facing={c.facing}
                phase={clock}
                ghost={c.ghost}
                size={charSize}
              />
            </View>
          ))}

          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  letterbox: { flex: 1, backgroundColor: colors.fillDeep },
  floor: {
    position: "absolute",
    backgroundColor: colors.fill,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    overflow: "hidden",
  },
  taskMarker: {
    position: "absolute",
    width: TASK_MARKER,
    height: TASK_MARKER,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentFill,
    borderRadius: 4,
  },
  balanceMarker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.accent,
  },
});
```

- [ ] **Step 2: tsc + Commit**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.

```bash
git add apps/mobile/src/components/party/PartyWorld.tsx
git commit -m "feat(mobile): PartyWorld — 로비·어몽 공용 레터박스 월드 렌더러"
```

---

### Task 10: `ActionPad` — 우측 버튼판

**Files:**
- Create: `apps/mobile/src/components/party/ActionPad.tsx`

**Interfaces:**
- Consumes: `wobbleRect`(doodle-path), `colors`/`fonts`(theme)
- Produces (파티 화면·AmongGame이 사용):

```ts
export interface PadAction {
  key: string;
  label: string;          // Gaegu 표시 — 14px 이상
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;       // 코랄 채움(킬 등 — 화면당 primary 1개 규칙 준수 책임은 호출부)
  cooldownRatio?: number; // 0..1 남은 비율 — SVG 원호 링
  sub?: string;           // 보조 텍스트(남은 초 등)
}
// props: { main: PadAction; secondaries?: PadAction[]; style? }
```

- [ ] **Step 1: 구현**

```tsx
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

function PadButton({ action, size }: { action: PadAction; size: number }) {
  const d = size - 4;
  const path = wobbleRect(d, d, circleRadius(d), action.key.length * 7 + 5, {
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
      style={[styles.btn, { width: size, height: size }, (action.disabled || cooling) && styles.dim]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={path}
          x={2}
          y={2}
          fill={action.accent ? colors.accent : "rgba(255,255,255,0.92)"}
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
      {action.sub ? <Text style={[styles.sub, action.accent && styles.labelAccent]}>{action.sub}</Text> : null}
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
```

- [ ] **Step 2: tsc + Commit**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.

```bash
git add apps/mobile/src/components/party/ActionPad.tsx
git commit -m "feat(mobile): ActionPad — 어몽어스식 컨텍스트 버튼판(쿨다운 링 포함)"
```

---

### Task 11: 파티 화면 개편 — 가로 lock + 조이스틱 적분 + 로비 월드

**Files:**
- Modify: `apps/mobile/app/(app)/party/[id].tsx`
- Modify: `apps/mobile/src/components/PartyChatOverlay.tsx` (`fabStyle` prop만)
- Delete: `apps/mobile/src/components/PartyRoomCanvas.tsx`

**Interfaces:**
- Consumes: Task 3 `moveWithCollision`/`worldDist`/`INTERACT_RANGE`, Task 5 `Joystick`, Task 6 `useLandscapeLock`, Task 9 `PartyWorld`/`WorldCharacter`, Task 10 `ActionPad`/`PadAction`, shared `PARTY_MAP`/`BALANCE_STATION_ID`
- Produces: AmongGame에 `characters: WorldCharacter[]` prop 전달 (Task 12가 소비 — 어몽은 이 배열에 ghost 플래그를 입힌다)

- [ ] **Step 1: `PartyChatOverlay`에 `fabStyle` prop 추가**

props에 `fabStyle?: StyleProp<ViewStyle>;` 추가(import에 `type StyleProp, type ViewStyle` 추가), FAB의 style을 `style={[styles.fab, { bottom: 24 + insets.bottom }, fabStyle]}`로. 그 외 무변경.

- [ ] **Step 2: `party/[id].tsx` 개편**

핵심 변경(파일 구조는 유지, 아래 조각들로 교체):

1. import 교체/추가:

```tsx
import { PARTY_MAP, BALANCE_STATION_ID } from "@mingle/shared";
import {
  clampToRoom,
  spawnFor,
  stepToward,
  shouldEmit,
  moveWithCollision,
  worldDist,
  INTERACT_RANGE,
  type Vec2,
} from "../../../src/lib/party-space";
import { useLandscapeLock } from "../../../src/lib/use-landscape";
import { PartyWorld, type WorldCharacter } from "../../../src/components/party/PartyWorld";
import { Joystick } from "../../../src/components/party/Joystick";
import { ActionPad, type PadAction } from "../../../src/components/party/ActionPad";
```

`PartyRoomCanvas` import 삭제. `AVATAR_TAP_RADIUS` 상수 삭제. `worldHeight` state 삭제.

2. 컴포넌트 최상단(훅 구역)에 추가:

```tsx
  useLandscapeLock();
  const velRef = useRef<Vec2>({ x: 0, y: 0 });
  const facingRef = useRef<Record<string, 1 | -1>>({});
```

3. rAF 루프 교체 — 내 캐릭터는 조이스틱 적분, 피어는 기존 lerp:

```tsx
  // Animation loop: 내 캐릭터 = 조이스틱 속도 적분(충돌 포함), 피어 = target lerp.
  useEffect(() => {
    if (!id || !party) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      let moved = false;
      for (const [pid, entry] of Object.entries(posRef.current)) {
        const next =
          pid === myProfileId
            ? moveWithCollision(entry.pos, velRef.current, dt)
            : stepToward(entry.pos, entry.target, dt);
        if (next.x !== entry.pos.x || next.y !== entry.pos.y) {
          if (next.x !== entry.pos.x) facingRef.current[pid] = next.x > entry.pos.x ? 1 : -1;
          entry.pos = next;
          moved = true;
          if (pid === myProfileId) {
            const sent = lastSentRef.current;
            if (shouldEmit(sent.pos, sent.at, next, now)) {
              socketRef.current?.move(id, next.x, next.y);
              lastSentRef.current = { pos: next, at: now };
            }
          }
        }
      }
      if (moved) setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id, party != null, myProfileId]);
```

4. `onTapMove`/`onLobbyTap` 함수 삭제. `roomMembers` 대신 캐릭터 배열:

```tsx
  const clock = Date.now();
  const characters: WorldCharacter[] = Object.entries(posRef.current).map(([pid, entry]) => {
    const mine = pid === myProfileId;
    const walking = mine
      ? velRef.current.x !== 0 || velRef.current.y !== 0
      : worldDist(entry.pos, entry.target) > 0.002;
    return {
      profileId: pid,
      name: mine ? "나" : (party.participants.find((p) => p.profileId === pid)?.name ?? "?"),
      pos: entry.pos,
      mine,
      walking,
      facing: facingRef.current[pid] ?? 1,
    };
  });
```

(`positions` 계산은 유지 — AmongGame이 사용.)

5. 로비 액션패드 컨텍스트:

```tsx
  const myPos = myProfileId ? (posRef.current[myProfileId]?.pos ?? null) : null;
  const balanceAnchor = PARTY_MAP.stations.find((s) => s.id === BALANCE_STATION_ID)!;
  const nearBalance = myPos !== null && worldDist(myPos, balanceAnchor) <= INTERACT_RANGE;
  let nearPeer: WorldCharacter | null = null;
  if (myPos) {
    let bd = Infinity;
    for (const c of characters) {
      if (c.mine || hidden[c.profileId]) continue;
      const d = worldDist(myPos, c.pos);
      if (d <= INTERACT_RANGE && d < bd) {
        nearPeer = c;
        bd = d;
      }
    }
  }
  const lobbyMain: PadAction = nearBalance
    ? {
        key: "balance",
        label: game?.status === "active" ? "게임 참여" : "밸런스 게임",
        onPress: () => setBalanceOpen(true),
      }
    : nearPeer
      ? { key: "profile", label: "프로필", onPress: () => openMemberSheet(nearPeer!.profileId) }
      : { key: "idle", label: "사용", onPress: () => {}, disabled: true };
```

6. JSX 월드 구역 교체 (기존 `styles.world` View 내부):

```tsx
      <View style={styles.world}>
        {showAmong && among ? (
          <AmongGame
            among={among}
            myProfileId={myProfileId ?? ""}
            partyId={partyId!}
            positions={positions}
            onTapMove={() => {}} // 임시 no-op — Task 12에서 prop 자체를 제거하고 characters/clock으로 교체
            handlers={amongHandlers}
          />
        ) : (
          <PartyWorld characters={characters} showBalanceStation clock={clock} />
        )}

        <PartyChatOverlay
          messages={messages}
          myProfileId={myProfileId}
          socketDown={socketDown}
          senderName={senderName}
          onSend={onSendChat}
          hideFab={hideFab}
          fabStyle={{ bottom: undefined, top: 8, right: 12 + insets.right }}
        />

        {(!showAmong || among?.phase === "playing") && (
          <Joystick
            onVector={(v) => {
              velRef.current = v;
            }}
            style={[styles.joystick, { left: 16 + insets.left, bottom: 20 + insets.bottom }]}
          />
        )}

        {!showAmong && (
          <ActionPad
            main={lobbyMain}
            style={[styles.actionPad, { right: 16 + insets.right, bottom: 20 + insets.bottom }]}
          />
        )}
      </View>
```

(어몽 중 조이스틱은 playing 페이즈에만. RoleReveal 2초 동안 겹쳐 보이는 건 허용 — 카드가 위에 덮음. `balanceStation` Pressable/`amongWrap`/`lobbyWrap` 제거.)

7. 스타일 추가/정리:

```tsx
  joystick: { position: "absolute", zIndex: 20 },
  actionPad: { position: "absolute", zIndex: 20 },
```

`balanceStation`, `lobbyWrap`, `amongWrap` 스타일 삭제. topBar `paddingHorizontal`을 `12 + insets.left` 인라인 반영: `<View style={[styles.topBar, { paddingLeft: 4 + insets.left, paddingRight: 4 + insets.right }]}>`.

8. AmongGame 시그니처는 이 시점엔 아직 옛 것 — 위 JSX처럼 `onTapMove={() => {}}` no-op을 임시로 넘겨 tsc 그린 유지. `characters`/`clock` prop 추가와 `onTapMove` 제거는 **Task 12에서**.

- [ ] **Step 3: `PartyRoomCanvas.tsx` 삭제**

Run: `git rm apps/mobile/src/components/PartyRoomCanvas.tsx`
확인: `grep -rn "PartyRoomCanvas" apps/mobile --include="*.tsx"` → 0건.

- [ ] **Step 4: tsc + vitest 확인**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.
Run: `pnpm --filter @mingle/mobile test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile
git commit -m "feat(mobile): 파티 화면 가로 게임 월드 개편 — 조이스틱 이동 + 로비 액션패드"
```

---

### Task 12: AmongGame 개편 — PartyWorld + ActionPad

**Files:**
- Modify: `apps/mobile/src/components/among/AmongGame.tsx`
- Modify: `apps/mobile/app/(app)/party/[id].tsx` (AmongGame에 `characters`/`clock` 전달, `onTapMove` 제거)
- Delete: `apps/mobile/src/components/among/AmongMap.tsx`

**Interfaces:**
- Consumes: Task 9 `PartyWorld`/`WorldCharacter`, Task 10 `ActionPad`/`PadAction`, 기존 `nearestTask`/`nearestKillTarget`/`nearbyBody`/`RANGE`(among.ts — Task 4에서 world 계량화됨)
- Produces: `AmongGame` 신규 시그니처:

```ts
{
  among: AmongSnapshot | null;
  myProfileId: string;
  partyId: string;
  positions: Record<string, Vec2>;
  characters: WorldCharacter[]; // 파티 화면이 준 로비 기준 배열 — 여기서 ghost 입힘
  clock: number;
  handlers: AmongHandlers;      // 기존 그대로
}
```

- [ ] **Step 1: AmongGame 개편**

변경 요지 (playing 분기만 — idle/meeting/ended/reveal 분기는 유지):

1. props에서 `onTapMove` 삭제, `characters: WorldCharacter[]`, `clock: number` 추가. import에서 `AmongMap` 삭제, 추가:

```tsx
import { PartyWorld, type WorldCharacter } from "../party/PartyWorld";
import { ActionPad, type PadAction } from "../party/ActionPad";
```

2. 쿨다운 링 리렌더용 1초 틱 (컴포넌트 상단 훅 구역):

```tsx
  // 킬 쿨다운 링은 초 단위 갱신이 필요 — 쿨다운 진행 중에만 1s 틱.
  const [, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!among?.killCooldownUntil || among.killCooldownUntil <= Date.now()) return;
    const t = setInterval(() => setCooldownTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [among?.killCooldownUntil]);
```

3. playing 분기 렌더 교체:

```tsx
  // 어몽 캐릭터: 로비 배열에 사망자 ghost 플래그를 입힌다
  const aliveById = new Map(among.players.map((p) => [p.profileId, p.alive]));
  const amongChars: WorldCharacter[] = characters
    .filter((c) => aliveById.has(c.profileId))
    .map((c) => ({ ...c, ghost: aliveById.get(c.profileId) === false }));

  const KILL_COOLDOWN_MS = 20000; // 서버 기본값(AMONG_KILL_COOLDOWN_MS) — 링 근사 표시용
  const cooldownLeft = among.killCooldownUntil ? among.killCooldownUntil - Date.now() : 0;
  const mainAction: PadAction = nearTask
    ? { key: "task", label: "미션", onPress: () => setMiniGameTaskId(nearTask.taskId) }
    : { key: "idle", label: "사용", onPress: () => {}, disabled: true };
  const secondaries: PadAction[] = [
    { key: "report", label: "신고", onPress: () => nearBody && handlers.report(nearBody.profileId), disabled: !nearBody },
    { key: "emergency", label: "긴급", onPress: handlers.emergency },
  ];
  if (isImpostor) {
    secondaries.push({
      key: "kill",
      label: "킬",
      accent: true,
      onPress: () => nearKillTarget && handlers.kill(nearKillTarget.profileId, myPos.x, myPos.y),
      disabled: !nearKillTarget,
      cooldownRatio: cooldownLeft > 0 ? Math.min(1, cooldownLeft / KILL_COOLDOWN_MS) : undefined,
      sub: cooldownLeft > 0 ? `${Math.ceil(cooldownLeft / 1000)}s` : undefined,
    });
  }

  return (
    <View style={styles.playingContainer}>
      <PartyWorld
        characters={amongChars}
        bodies={among.bodies}
        taskMarkers={among.myTasks.filter((t) => !t.done).map((t) => ({ id: t.taskId, x: t.x, y: t.y }))}
        clock={clock}
      />

      {/* 진행률 — 상단 중앙 오버레이 */}
      <View style={styles.progressRow} pointerEvents="none">
        <Text style={styles.progressLabel}>미션 진행률</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${among.progress.total > 0 ? (among.progress.done / among.progress.total) * 100 : 0}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressCount}>
          {among.progress.done}/{among.progress.total}
        </Text>
      </View>

      {iAmDead ? (
        <View style={styles.spectatorBadge} pointerEvents="none">
          <Text style={styles.spectatorText}>관전 중 👻</Text>
        </View>
      ) : (
        <ActionPad main={mainAction} secondaries={secondaries} style={styles.actionPad} />
      )}

      {/* Minigame modal — 가로 중앙 카드 (Task 13에서 오버레이 일괄 처리와 동일 패턴) */}
      ...기존 Modal 유지...
    </View>
  );
```

4. 스타일 교체:

```tsx
  playingContainer: { flex: 1 },
  progressRow: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: "50%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  spectatorBadge: { position: "absolute", bottom: 24, alignSelf: "center", ...기존 나머지 키 유지 },
  actionPad: { position: "absolute", right: 16, bottom: 20, zIndex: 20 },
```

(`actionBar`/`actionBtn` 스타일 삭제. `nearTask`/`nearKillTarget`/`nearBody`/`iAmDead`/`myPos` 계산 로직은 기존 그대로 유지 — 계량은 Task 4에서 이미 world.)

5. idle 분기(게임 없음): 현행 유지하되 부모가 로비를 보여주므로 도달하지 않음 — `if (!among) return null;`로 단순화.

- [ ] **Step 2: 파티 화면에서 신규 props 전달**

Task 11에서 남긴 임시 `onTapMove={() => {}}` 제거, `characters={characters} clock={clock}` 추가.

- [ ] **Step 3: `AmongMap.tsx` 삭제**

Run: `git rm apps/mobile/src/components/among/AmongMap.tsx`
확인: `grep -rn "AmongMap" apps/mobile` → 0건.

- [ ] **Step 4: tsc + vitest**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.
Run: `pnpm --filter @mingle/mobile test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile
git commit -m "feat(mobile): AmongGame을 PartyWorld+ActionPad로 개편 — 킬 쿨다운 링"
```

---

### Task 13: 오버레이 가로 대응 — 중앙 카드 통일

**Files:**
- Modify: `apps/mobile/src/components/PartyChatOverlay.tsx`
- Modify: `apps/mobile/src/components/MemberSheet.tsx`
- Modify: `apps/mobile/app/(app)/party/[id].tsx` (밸런스 모달)
- Modify: `apps/mobile/src/components/among/AmongGame.tsx` (미니게임 모달)
- Modify: `apps/mobile/src/components/among/MeetingScreen.tsx`, `ResultScreen.tsx`, `RoleReveal.tsx`

**Interfaces:**
- Consumes: 기존 컴포넌트들 — 시그니처 변화 없음(스타일만)
- Produces: 파티 화면의 모든 모달 = 중앙 카드(maxWidth 480), 전체화면 뷰(회의/결과/리빌) = 중앙 maxWidth 560

- [ ] **Step 1: 패턴 정의 — 4개 모달 공통 변경**

파티 화면은 항상 가로이므로(유일 소비처) 분기 없이 무조건 중앙 카드:

- `modalRoot`: `{ flex: 1, justifyContent: "flex-end" }` → `{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }`
- 패널(WobbleBox/sheet): radius를 `doodle.radius.card`로(플러시 하단 라디우스 제거), `width: "100%", maxWidth: 480, maxHeight: "88%"` 추가, `height: "42%"` 류 고정 높이 제거.
- PartyChatOverlay `PANEL_RADIUS` 상수 삭제 → `doodle.radius.card` 사용, panel 스타일 `{ width: "100%", maxWidth: 480, height: 300 }`, `paddingBottom` inset 제거(중앙 카드라 불필요 — `contentStyle={[styles.panelInner]}`).
- MemberSheet 동일 패턴 (`PANEL_RADIUS` → `doodle.radius.card`).
- 밸런스 모달(`[id].tsx` `modalRoot`/`balanceSheet`): 동일 패턴 + `borderWidth: doodle.border` 전체 보더.
- 미니게임 모달(AmongGame `modalOverlay`/`modalSheet`): `justifyContent: "center", alignItems: "center"` + sheet `{ width: "100%", maxWidth: 480, borderWidth: 2, borderColor: colors.ink, borderRadius: 20, minHeight: 280 }`(top-only 라디우스/보더 제거).

- [ ] **Step 2: 전체화면 뷰 3개**

- `MeetingScreen`: 루트 container에 `alignItems: "center"`, card에 `width: "100%", maxWidth: 560`, 리스트 `maxHeight: 160`.
- `ResultScreen`/`RoleReveal`: 동일 — 루트 center 정렬 + 카드 `maxWidth: 560, width: "100%"`.

- [ ] **Step 3: tsc + vitest + 웹 스모크**

Run: `cd apps/mobile && npx tsc --noEmit` — 에러 0.
Run: `pnpm --filter @mingle/mobile test` — PASS.
Run: `cd apps/mobile && npx expo export --platform web --output-dir /tmp/mingle-web-smoke` — 번들 성공(경고 허용, 에러 0).

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile
git commit -m "style(mobile): 파티 오버레이 가로 대응 — 하단 시트를 중앙 카드로 통일"
```

---

### Task 14: 정리 + 문서 + 전체 검증

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/qa/2026-07-14-native-e2e-runbook.md`
- 전체 검증 (코드 변경 없음 기대)

- [ ] **Step 1: 잔재 확인**

```bash
grep -rn "PartyRoomCanvas\|AmongMap\|onTapMove\|randomInRoom\|AVATAR_TAP_RADIUS" apps packages --include="*.ts" --include="*.tsx" | grep -v node_modules
```
Expected: 0건 (스펙/플랜 문서 제외). 남으면 제거.

- [ ] **Step 2: CLAUDE.md 갱신**

- "tap-to-move는 NATIVE 전용" gotcha 항목 삭제 → 교체: `⚠️ **이동 = 좌측 조이스틱**(PanResponder — 웹 포함 동작). 파티 화면은 expo-screen-orientation으로 가로 고정(루트는 세로 lock, app.json orientation="default"). 거리·충돌은 world 계량(x×1.9) — 맵/스테이션 단일 진실은 @mingle/shared PARTY_MAP(백엔드 태스크 배치 공유).`
- 파티 화면 설명 줄에서 `PartyRoomCanvas` → `PartyWorld`(로비+어몽 공용), 밸런스 게임 진입 = DJ 부스 앞 액션패드.
- 두들 프리미티브 목록에 `party/` 컴포넌트(PartyWorld/PartyMapArt/DoodleCharacter/Joystick/ActionPad) 한 줄 추가.
- Status/백로그의 "웹 tap-to-move" 항목 삭제(해소됨).

- [ ] **Step 3: E2E 런북에 가로/조이스틱 체크리스트 추가**

`docs/qa/2026-07-14-native-e2e-runbook.md` 끝에 §추가:

```markdown
## §6. 가로 게임 월드 (2026-07-16 추가)

- [ ] 파티 입장 시 가로 전환, 나가면 세로 복귀 (iOS/Android 각각)
- [ ] 노치 쪽 safe inset — 조이스틱/액션패드/상단바 가림 없음 (기기 양방향 회전)
- [ ] 조이스틱: 데드존, 아날로그 속도(살짝/끝까지), 놓으면 정지, 전화 인터럽트 시 정지
- [ ] 가구 충돌: 테이블/바에 막히고 벽 슬라이딩, 스폰이 댄스플로어 안
- [ ] 로비: 유저 옆 → "프로필", DJ 부스 앞 → "밸런스 게임", 그 외 dim
- [ ] 어몽: 태스크 마커 station 위치, 미션/신고/긴급/킬(쿨다운 링) 버튼, 유령 이동
- [ ] 채팅/멤버시트/밸런스/미니게임 = 중앙 카드, 가로 키보드에서 입력 가능
```

- [ ] **Step 4: 전체 검증**

```bash
pnpm build          # shared → client-core → apps 순서 성공
pnpm test           # client-core 73 + backend 295+1 + mobile 84+α 전부 그린
cd apps/mobile && npx tsc --noEmit
```
백엔드 dev 서버(:3000)가 떠 있으면 `/mega-qa` 스킬로 60체크 회귀(소켓 프로토콜 무변경 — 60/60 기대). 안 떠 있으면 사용자에게 실행 요청.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/qa/2026-07-14-native-e2e-runbook.md
git commit -m "docs: 가로 게임 월드 반영 — CLAUDE.md 갱신 + E2E 런북 §6"
```

---

## 리스크·주의 노트 (구현자용)

- **shared 빌드 선행**: Task 1 이후 모든 mobile/backend 작업 전 `pnpm --filter @mingle/shared build`. mobile vitest도 dist를 해석한다.
- **`.npmrc` `node-linker=hoisted` 절대 유지** — expo install 후 diff 확인. node_modules 이상 시 전체 삭제 후 재설치(+bcrypt 재빌드 gotcha).
- **PanResponder dx/dy는 grant 기준** — `locationX` 사용 금지(RN Web에서 빈 값).
- **`Date.now()` 사용은 컴포넌트 렌더/핸들러에서만** — 순수 lib(party-space 등)에 시계 주입 금지(테스트 결정성).
- 서버 `AMONG_KILL_COOLDOWN_MS`를 바꾼 배포에서는 클라 링(20s 상수)이 근사치가 됨 — 숫자(초)는 `killCooldownUntil` 기반이라 정확. 허용.
- 진행 중이던 어몽 세션(배포 전 시작)은 랜덤 좌표 태스크 유지 — 가구 안에 마커가 보일 수 있음. dev 허용(스펙 §9).
