# Phase 6b: 2D Top-Down Party Space (Skia) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Skia-rendered 2D top-down party room in `party/[id].tsx`: tap-to-move self avatar, throttled `party:move` broadcast, live peer avatars from `party:moved`/`party:presence`, smooth interpolation — mobile-only (the 6a gateway is complete and untouched).

**Architecture:** Pure movement math in a unit-tested lib (`party-space.ts`); a render-only Skia canvas component (`PartyRoomCanvas`); the party screen owns a positions ref + one rAF loop that lerps every avatar toward its target and emits self position through the existing 6a `PartySocketHandle` gated by a throttle. Coordinates normalized 0..1.

**Tech Stack:** `@shopify/react-native-skia` (Expo SDK 56 bundled native module — the ONLY new dependency), React Native, Vitest for `src/lib`, `tsc` for components/screens.

## Global Constraints

- Backend/shared/client-core: **NO changes**. The 6a events are the contract: emit `handle.move(partyId, x, y)`; receive `onMoved: PartyMove {profileId,x,y}`, roster via `onPresence`.
- Coordinates normalized `0..1`; constants: `ROOM_MARGIN 0.06`, `MOVE_SPEED 0.35/s`, `EMIT_MIN_INTERVAL_MS 100`, `EMIT_MIN_DELTA 0.005`.
- **Pure black & white:** `#17150F`, `#FFFFFF`, `#45413A`, `#8A857C`, `#D9D5CC`, `#F1EFE9` only.
- Rules of Hooks: all new hooks in `party/[id].tsx` go BEFORE the early returns.
- rAF loop re-renders ONLY when something moved (idle ⇒ zero re-renders).
- Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons); TS strict. Never stage `.env`. Do NOT push.
- ANSI-safe grep for `error TS` (pipe through `sed -E 's/\x1b\[[0-9;]*m//g'`).

---

### Task 1: install `@shopify/react-native-skia` + bundle smoke

**Files:**
- Modify: `apps/mobile/package.json` (+ lockfile) via `expo install`

- [ ] **Step 1:** `cd apps/mobile && pnpm exec expo install @shopify/react-native-skia`
(uses the SDK-56-pinned version; pnpm workspace + `node-linker=hoisted` already configured).
- [ ] **Step 2:** `cd /Users/namuneulbo/Desktop/MingleAI/.claude/worktrees/mobile-pivot-plan && pnpm install --no-frozen-lockfile 2>&1 | tail -3` (settle the lockfile).
- [ ] **Step 3: iOS bundle smoke** — `cd apps/mobile && CI=1 pnpm exec expo export --platform ios --output-dir "$TMPDIR/p6b-smoke" 2>&1 | tail -6`
Expected: `iOS Bundled … (N modules)` with exit 0 (Skia's JS side bundles cleanly).
- [ ] **Step 4:** `pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN; `pnpm exec vitest run 2>&1 | grep -E "Tests |FAIL"` → 10 passed.
- [ ] **Step 5: Commit** — `git add apps/mobile/package.json pnpm-lock.yaml && git commit -m "feat(mobile): add @shopify/react-native-skia (Expo bundled module)"`

---

### Task 2: `party-space.ts` pure movement lib (TDD)

**Files:**
- Create: `apps/mobile/src/lib/party-space.ts`
- Test: `apps/mobile/src/lib/__tests__/party-space.test.ts`

**Interfaces — Produces (Tasks 3–4 rely on these exact names):**
`Vec2 {x,y}`; consts `ROOM_MARGIN=0.06`, `MOVE_SPEED=0.35`, `EMIT_MIN_INTERVAL_MS=100`, `EMIT_MIN_DELTA=0.005`; `clampToRoom(p)`, `stepToward(current,target,dtMs)`, `shouldEmit(lastSent,lastSentAtMs,next,nowMs)`, `spawnFor(profileId)`, `initialOf(name)`.

- [ ] **Step 1: Write the failing test** — `apps/mobile/src/lib/__tests__/party-space.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  clampToRoom,
  stepToward,
  shouldEmit,
  spawnFor,
  initialOf,
  ROOM_MARGIN,
  EMIT_MIN_INTERVAL_MS,
} from "../party-space";

describe("clampToRoom", () => {
  it("clamps both axes into the margin-inset unit square", () => {
    expect(clampToRoom({ x: -1, y: 2 })).toEqual({ x: ROOM_MARGIN, y: 1 - ROOM_MARGIN });
    expect(clampToRoom({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("stepToward", () => {
  it("moves toward the target scaled by dt", () => {
    const next = stepToward({ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, 100); // 0.035 step
    expect(next.x).toBeCloseTo(0.035, 5);
    expect(next.y).toBeCloseTo(0.5, 5);
  });
  it("snaps onto the target when closer than one step", () => {
    expect(stepToward({ x: 0.999, y: 0.5 }, { x: 1, y: 0.5 }, 100)).toEqual({ x: 1, y: 0.5 });
  });
  it("is stationary at the target", () => {
    expect(stepToward({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 }, 16)).toEqual({ x: 0.3, y: 0.3 });
  });
});

describe("shouldEmit", () => {
  it("always emits the first position", () => {
    expect(shouldEmit(null, 0, { x: 0.5, y: 0.5 }, 0)).toBe(true);
  });
  it("suppresses within the min interval", () => {
    expect(shouldEmit({ x: 0, y: 0 }, 1000, { x: 1, y: 1 }, 1000 + EMIT_MIN_INTERVAL_MS - 1)).toBe(
      false,
    );
  });
  it("suppresses sub-delta jitter even after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.5001, y: 0.5 }, 500)).toBe(false);
  });
  it("emits a real move after the interval", () => {
    expect(shouldEmit({ x: 0.5, y: 0.5 }, 0, { x: 0.6, y: 0.5 }, 500)).toBe(true);
  });
});

describe("spawnFor", () => {
  it("is deterministic and in-bounds", () => {
    const a1 = spawnFor("profile-a");
    expect(spawnFor("profile-a")).toEqual(a1);
    expect(a1.x).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(a1.x).toBeLessThanOrEqual(1 - ROOM_MARGIN);
    expect(a1.y).toBeGreaterThanOrEqual(ROOM_MARGIN);
    expect(a1.y).toBeLessThanOrEqual(1 - ROOM_MARGIN);
  });
  it("spreads different ids apart", () => {
    const a = spawnFor("profile-a");
    const b = spawnFor("profile-b");
    expect(a).not.toEqual(b);
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

- [ ] **Step 2: Run to verify failure** — `cd apps/mobile && pnpm exec vitest run src/lib/__tests__/party-space.test.ts 2>&1 | grep -E "FAIL|Cannot find"` → FAIL (module missing).

- [ ] **Step 3: Create `apps/mobile/src/lib/party-space.ts`**

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export const ROOM_MARGIN = 0.06; // avatar-radius margin, normalized
export const MOVE_SPEED = 0.35; // normalized units per second
export const EMIT_MIN_INTERVAL_MS = 100; // ≤10Hz network emits
export const EMIT_MIN_DELTA = 0.005; // normalized min movement to emit

/** Clamp a point into the walkable room (margin-inset unit square). */
export function clampToRoom(p: Vec2): Vec2 {
  const clamp = (v: number) => Math.min(Math.max(v, ROOM_MARGIN), 1 - ROOM_MARGIN);
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** One animation step toward target at MOVE_SPEED; snaps when closer than the step. */
export function stepToward(current: Vec2, target: Vec2, dtMs: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  const step = MOVE_SPEED * (dtMs / 1000);
  if (dist === 0 || dist <= step) return { x: target.x, y: target.y };
  return { x: current.x + (dx / dist) * step, y: current.y + (dy / dist) * step };
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

/** Deterministic spawn point from a profileId (djb2 hash spread over the room). */
export function spawnFor(profileId: string): Vec2 {
  let h = 5381;
  for (let i = 0; i < profileId.length; i++) {
    h = ((h << 5) + h + profileId.charCodeAt(i)) >>> 0;
  }
  const gx = (h % 1000) / 1000;
  const gy = (Math.floor(h / 1000) % 1000) / 1000;
  return clampToRoom({ x: 0.15 + gx * 0.7, y: 0.15 + gy * 0.7 });
}

/** First grapheme-ish initial for the avatar label. */
export function initialOf(name: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? [...trimmed][0]! : "?";
}
```

- [ ] **Step 4: Run to verify pass + full mobile suite** — `pnpm exec vitest run 2>&1 | grep -E "Test Files|Tests |FAIL"` → 22 passed (12 new + 10).
- [ ] **Step 5: Commit** — `git add apps/mobile/src/lib/party-space.ts apps/mobile/src/lib/__tests__/party-space.test.ts && git commit -m "feat(mobile): party-space movement/throttle/spawn lib"`

---

### Task 3: `PartyRoomCanvas` component

**Files:**
- Create: `apps/mobile/src/components/PartyRoomCanvas.tsx`

**Interfaces:**
- Consumes: Task 2's `clampToRoom`, `initialOf`, `Vec2`; `Canvas`, `Circle`, `RoundedRect` from `@shopify/react-native-skia`.
- Produces: `PartyRoomCanvas` (named export) with props `{ members: PartyRoomMember[]; myProfileId: string | null; onTapMove: (target: Vec2) => void; height?: number }`; `PartyRoomMember { profileId; name; pos: Vec2 }`.

**Gate:** `tsc --noEmit` CLEAN (no RN render harness — established convention).

- [ ] **Step 1: Create `apps/mobile/src/components/PartyRoomCanvas.tsx`**

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Canvas, Circle, RoundedRect } from "@shopify/react-native-skia";
import { clampToRoom, initialOf, type Vec2 } from "../lib/party-space";

const INK = "#17150F";
const PAPER = "#FFFFFF";
const FILL = "#F1EFE9";
const AVATAR_R = 14;

export interface PartyRoomMember {
  profileId: string;
  name: string;
  pos: Vec2;
}

export function PartyRoomCanvas({
  members,
  myProfileId,
  onTapMove,
  height = 260,
}: {
  members: PartyRoomMember[];
  myProfileId: string | null;
  onTapMove: (target: Vec2) => void;
  height?: number;
}) {
  const [width, setWidth] = useState(0);

  return (
    <Pressable
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        if (!width) return;
        onTapMove(
          clampToRoom({
            x: e.nativeEvent.locationX / width,
            y: e.nativeEvent.locationY / height,
          }),
        );
      }}
      style={{ height }}
      accessibilityLabel="파티 공간"
    >
      {width > 0 ? (
        <>
          <Canvas style={{ width, height }}>
            <RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={12} color={FILL} />
            <RoundedRect
              x={1}
              y={1}
              width={width - 2}
              height={height - 2}
              r={12}
              color={INK}
              style="stroke"
              strokeWidth={2}
            />
            {members.map((m) => (
              <Circle
                key={m.profileId}
                cx={m.pos.x * width}
                cy={m.pos.y * height}
                r={AVATAR_R}
                color={m.profileId === myProfileId ? INK : PAPER}
              />
            ))}
            {members.map((m) => (
              <Circle
                key={`ring-${m.profileId}`}
                cx={m.pos.x * width}
                cy={m.pos.y * height}
                r={AVATAR_R}
                color={INK}
                style="stroke"
                strokeWidth={2}
              />
            ))}
          </Canvas>
          {members.map((m) => {
            const mine = m.profileId === myProfileId;
            return (
              <View
                key={m.profileId}
                pointerEvents="none"
                style={[
                  styles.label,
                  {
                    left: m.pos.x * width - AVATAR_R,
                    top: m.pos.y * height - AVATAR_R,
                  },
                ]}
              >
                <Text style={[styles.initial, { color: mine ? PAPER : INK }]}>
                  {initialOf(m.name)}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    width: AVATAR_R * 2,
    height: AVATAR_R * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 12, fontWeight: "700" },
});
```

- [ ] **Step 2: Verify tsc CLEAN** — `pnpm --filter @mingle/shared build >/dev/null 2>&1 && pnpm --filter @mingle/client-core build >/dev/null 2>&1 && cd apps/mobile && pnpm exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN` → CLEAN.
- [ ] **Step 3: Commit** — `git add apps/mobile/src/components/PartyRoomCanvas.tsx && git commit -m "feat(mobile): PartyRoomCanvas — Skia 2D room with doodle avatars"`

---

### Task 4: wire the 2D space into `party/[id].tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/party/[id].tsx`

**Interfaces:**
- Consumes: Task 2 lib, Task 3 component, the EXISTING 6a socket effect (`openPartySocket` handlers + `socketRef: PartySocketHandle`), `type PartyMove` from `@mingle/client-core`.

- [ ] **Step 1: imports** — add:

```tsx
import { PartyRoomCanvas } from "../../../src/components/PartyRoomCanvas";
import { clampToRoom, spawnFor, stepToward, shouldEmit, type Vec2 } from "../../../src/lib/party-space";
```

- [ ] **Step 2: state/refs** (with the other hooks, BEFORE the early returns):

```tsx
  // 2D room positions — ref-driven; a tick state re-renders only when something moved.
  const posRef = useRef<Record<string, { pos: Vec2; target: Vec2 }>>({});
  const rosterRef = useRef<string[]>([]);
  const lastSentRef = useRef<{ pos: Vec2 | null; at: number }>({ pos: null, at: 0 });
  const [, setFrame] = useState(0);
```

- [ ] **Step 3: extend the existing socket handlers** — inside the 6a socket `useEffect`, REPLACE the `onPresence` handler line with:

```tsx
      onPresence: (p) => {
        if (!alive) return;
        setPresentCount(p.members.length);
        rosterRef.current = p.members;
        for (const pid of p.members) {
          if (!posRef.current[pid]) {
            const spawn = spawnFor(pid);
            posRef.current[pid] = { pos: spawn, target: spawn };
          }
        }
        for (const pid of Object.keys(posRef.current)) {
          if (!p.members.includes(pid) && pid !== myProfileId) delete posRef.current[pid];
        }
        setFrame((f) => f + 1);
      },
```

and ADD alongside the other handlers:

```tsx
      onMoved: (m) => {
        if (!alive) return;
        const entry = posRef.current[m.profileId];
        const target = clampToRoom({ x: m.x, y: m.y });
        if (entry) entry.target = target;
        else posRef.current[m.profileId] = { pos: target, target };
      },
```

(also ensure the self entry exists right after `handle.joinParty(id)`:)

```tsx
    if (myProfileId && !posRef.current[myProfileId]) {
      const spawn = spawnFor(myProfileId);
      posRef.current[myProfileId] = { pos: spawn, target: spawn };
    }
```

- [ ] **Step 4: the rAF loop** — a NEW `useEffect` directly below the socket effect (still before the early returns):

```tsx
  // Animation loop: lerp every avatar toward its target; emit self position, throttled.
  useEffect(() => {
    if (!id || !party) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      let moved = false;
      for (const [pid, entry] of Object.entries(posRef.current)) {
        const next = stepToward(entry.pos, entry.target, dt);
        if (next.x !== entry.pos.x || next.y !== entry.pos.y) {
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

- [ ] **Step 5: tap handler + members projection** (plain functions/consts before the JSX return):

```tsx
  function onTapMove(target: Vec2) {
    if (!myProfileId) return;
    const entry = posRef.current[myProfileId];
    if (entry) entry.target = target;
  }

  const roomMembers = Object.entries(posRef.current).map(([pid, entry]) => ({
    profileId: pid,
    name:
      pid === myProfileId
        ? "나"
        : (party.participants.find((p) => p.profileId === pid)?.name ?? "?"),
    pos: entry.pos,
  }));
```

- [ ] **Step 6: JSX** — insert the room canvas section ABOVE the chat section (`<View style={styles.chatSection}>`):

```tsx
      <View style={styles.roomSection}>
        <Text style={styles.roomTitle}>파티 공간 — 탭해서 이동</Text>
        <PartyRoomCanvas members={roomMembers} myProfileId={myProfileId} onTapMove={onTapMove} />
      </View>
```

and add the two styles:

```tsx
  roomSection: { gap: 6 },
  roomTitle: { fontSize: 13, fontWeight: "700", color: "#45413A" },
```

- [ ] **Step 7: Verify** — tsc CLEAN (ANSI-safe), mobile vitest 22/22, iOS bundle smoke (`CI=1 pnpm exec expo export --platform ios --output-dir "$TMPDIR/p6b-smoke2" 2>&1 | tail -4`) exits 0.
- [ ] **Step 8: Commit** — `git add "apps/mobile/app/(app)/party/[id].tsx" && git commit -m "feat(mobile): 2D party room — tap-to-move avatars over party:move"`

---

## Plan Self-Review

**Spec coverage:** Skia dep (T1); pure lib + constants (T2); render-only canvas w/ B&W doodle avatars + tap→normalized coords (T3); positions/roster/rAF/throttle/self-emit/peer-lerp + presence pruning + JSX section (T4); no backend change (no task touches it); bundle smoke in T1+T4. Gaps: none.

**Placeholder scan:** none — full code everywhere.

**Type consistency:** `Vec2`, `clampToRoom`, `stepToward(current,target,dtMs)`, `shouldEmit(lastSent,lastSentAtMs,next,nowMs)`, `spawnFor`, `initialOf` identical across T2/T3/T4; `PartyRoomMember {profileId,name,pos}` matches T4's projection; `socketRef.current?.move(id, x, y)` matches 6a's `PartySocketHandle.move`.
