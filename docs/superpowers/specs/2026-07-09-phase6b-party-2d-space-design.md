# Phase 6b: 2D Top-Down Party Space (Skia) — Design

**Date:** 2026-07-09
**Status:** Approved design (pre-plan; sub-decisions defaulted under the standing /goal directive — noted inline)
**Branch:** `megahuni`

## Goal

Turn the party room into the "어몽어스"-style 2D top-down space the vision describes (`DEVELOPMENT_PLAN.md §3.4`): each participant is a doodle avatar in a shared room; you tap where you want to go, your avatar glides there, and everyone sees everyone's movement live — over the `party:move`/`party:moved` transport Phase 6a shipped and E2E-verified (15/15).

## Scope (6b = mobile-only)

**In:** a Skia-rendered party room canvas in `party/[id].tsx`; tap-to-move locomotion with smooth interpolation; throttled position broadcast; live peer avatars driven by `party:moved` + `party:presence`; pure movement/throttle logic in a unit-tested lib; the `@shopify/react-native-skia` dependency.

**Out:** minigames (6c); backend changes (NONE — 6a's gateway is complete and untouched); position persistence; collision/obstacles; joystick controls; avatar customization; Skia-rendered text (names overlay as RN `Text` to avoid font loading).

## Key decisions (defaulted, per the /goal continuous directive)

1. **Renderer = `@shopify/react-native-skia`** — honors the user's explicit "풀 2D 이동 공간 (Skia + 위치 동기화)" choice and `DEVELOPMENT_PLAN §5.2`. It is an Expo SDK 56 bundled native module (`npx expo install` — works in Expo Go; JS bundles headlessly for verification). The ONLY new dependency of 6b.
2. **Locomotion = tap-to-move** (no joystick, no gesture-handler dep): tap the room → avatar lerps to the target at constant speed; simplest control that reads well on mobile.
3. **Coordinates are normalized `0..1`** in both axes (protocol-compatible: `party:move {x,y}` carries plain numbers). Devices of different sizes agree on positions; rendering scales by the local canvas size.
4. **Spawn = deterministic hash of profileId** → stable, spread-out initial positions without coordination.
5. **Throttle: emit at most every 100ms AND only if moved ≥ 0.005 normalized units** — ~10Hz ceiling, silent when idle.
6. **Peers interpolate too:** incoming `party:moved` sets a peer's *target*; a shared rAF loop lerps every avatar toward its target each frame (smooth at 10Hz updates).
7. **Presence-driven roster:** avatars exist for profileIds in the latest `party:presence` roster (self always shown); a member who disconnects disappears.
8. **B&W doodle look:** paper room with ink border; avatars = ink-stroked circles (self = filled ink + paper initial, peers = paper fill + ink initial), name initial via RN `Text` overlay.

## Design

### 1. `apps/mobile/src/lib/party-space.ts` — pure, unit-tested logic

```ts
export interface Vec2 { x: number; y: number; }

export const ROOM_MARGIN = 0.06;               // avatar-radius margin, normalized
export const MOVE_SPEED = 0.35;                // normalized units / second
export const EMIT_MIN_INTERVAL_MS = 100;       // ≤10Hz
export const EMIT_MIN_DELTA = 0.005;           // normalized

/** Clamp a point into the walkable room (margin-inset unit square). */
export function clampToRoom(p: Vec2): Vec2;

/** One animation step toward target at MOVE_SPEED; snaps when closer than the step. */
export function stepToward(current: Vec2, target: Vec2, dtMs: number): Vec2;

/** Throttle gate for network emits. */
export function shouldEmit(
  lastSent: Vec2 | null, lastSentAtMs: number, next: Vec2, nowMs: number,
): boolean;

/** Deterministic spawn point from a profileId (djb2 hash → spread in the room). */
export function spawnFor(profileId: string): Vec2;

/** First grapheme-ish initial for the avatar label ("김철수" → "김"). */
export function initialOf(name: string): string;
```

All five are pure; Vitest covers clamping bounds, step-snap behavior, dt scaling, throttle interval+delta gates, spawn determinism/spread/in-bounds, and initials (hangul/latin/empty).

### 2. `apps/mobile/src/components/PartyRoomCanvas.tsx` — render-only

Props:
```ts
{
  members: { profileId: string; name: string; pos: Vec2 }[];  // includes self
  myProfileId: string | null;
  onTapMove: (target: Vec2) => void;   // normalized coords
  height?: number;                      // default 260
}
```
- Measures its width via `onLayout`; renders a Skia `<Canvas>`: paper `RoundedRect` floor + ink border, one `Circle` (r≈14px) per member — self filled `#17150F`, peers `#FFFFFF` fill with `#17150F` stroke.
- Absolutely-positioned RN `Text` initials over each circle (paper-on-ink for self, ink-on-paper for peers); a gray "me" caret/label under the self avatar.
- A wrapping `Pressable` converts tap `locationX/Y` → normalized coords → `onTapMove(clampToRoom(p))`.
- Pure B&W: `#17150F`, `#FFFFFF`, grays `#45413A`/`#8A857C`/`#D9D5CC`, fill `#F1EFE9` only.

### 3. `party/[id].tsx` wiring (the 2D space section sits ABOVE the chat section)

- New state: `positions: Record<profileId, {pos, target}>`; `rosterRef` from the existing `onPresence` handler (extend it — do not replace the chat handlers); self target set by `onTapMove`.
- Extend the EXISTING 6a socket `useEffect`: add `onMoved: (m) => setTarget(m.profileId, {x: m.x, y: m.y})` to the handlers object. Reuse the same `PartySocketHandle` — `handle.move(id, x, y)` for emits.
- A single `requestAnimationFrame` loop (started when the party is loaded, stopped on cleanup) advances every member's `pos` toward its `target` via `stepToward`, and — for self — calls `handle.move` gated by `shouldEmit` (tracking `lastSent`/`lastSentAt` in refs).
- Members rendered = presence roster ∪ self; a peer with no known position yet spawns at `spawnFor(profileId)`. Peers removed from the roster drop out of `positions`.
- Names come from `party.participants` (already fetched); fallback label "?" for a roster profileId not in the participant list (shouldn't happen — same authz set).

### 4. Dependency

`pnpm --filter @mingle/mobile exec expo install @shopify/react-native-skia` (SDK-pinned version). No other new deps. `.npmrc node-linker=hoisted` already in place (Metro requirement).

## Error handling

Socket loss degrades exactly as 6a: `socketDown` notice; avatars freeze at last-known positions; chat/presence recovery via the existing `onReconnect`. Tap events while disconnected still move the local avatar (emits resume on reconnect via the throttle gate).

## Testing

- **Vitest** (`src/lib/__tests__/party-space.test.ts`): the five pure functions (bounds, snap, dt, throttle both gates, spawn determinism + spread + bounds, initials).
- **tsc --noEmit CLEAN** for the component + screen (established convention; no RN render harness).
- **Bundle smoke:** `expo export --platform ios` (and android) must bundle Skia + the new screen cleanly — the headless native-path proxy used in Phase 5c.
- **Transport E2E:** already proven live by the Phase-6a 15/15 2-socket run (`party:move` relayed to others only, never echoed); 6b adds no server behavior.

## Out of scope / backlog

- Skia-drawn name text (font loading) — RN overlay is the MVP.
- Obstacles/rooms-within-room, avatar sprites, walk animation (doodle bounce), joystick, minigame zones (6c hooks in here later).
- Reduced-motion accessibility toggle.
