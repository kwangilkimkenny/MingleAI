# Phase 6d — Among Us Party Minigame Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A real, playable Among Us social-deduction minigame inside a MingleAI party — role assignment, minigame tasks, impostor kills, body reports/emergency meetings, discussion timer, voting/ejection, win conditions — playable solo via AI bot players.

**Architecture:** New `gameType: "among"` on the existing `GameSession` model (DB-as-only-state, per-party `pg_advisory_xact_lock` transaction, mutually exclusive with the balance game). New `AmongService` state machine + `AmongConfigProvider`. `PartyGateway` gains `among:*` events + a meeting-timer sweep; broadcasts are **per-socket personalized** (role hidden). Movement reuses `party:move`. Mobile renders an extended 2D map + 4 touch minigames + meeting/vote/result screens. `tools/among-bots.mjs` fills parties.

**Tech Stack:** NestJS 10 + Prisma/Postgres, Socket.IO, `@mingle/shared` (ESM+CJS), `@mingle/client-core` (zustand/socket.io-client, Vitest), Expo/React Native (plain RN Views, no new deps), jest (backend), Vitest (client-core/mobile).

## Global Constraints

- **No new npm dependencies** anywhere. Minigames + map = plain RN Views. Bots use existing `socket.io-client`.
- **No DB migration.** State lives in `GameSession.state` (Json). `gameType="among"`, one active session per party (existing partial unique index).
- **Every state transition** runs inside `prisma.$transaction` guarded by `SELECT pg_advisory_xact_lock(hashtext(partyId)::bigint)` (mirror `GameService`). `current()`/`project()` are lock-free reads.
- **Roles are secret:** the gateway emits a per-viewer `AmongSnapshot` (never the authoritative `AmongState`). Other players' `role` is `null` unless `phase==="ended"`. `myTasks` only the viewer's. Vote targets hidden until reveal (`votedProfileIds` only).
- **Light client trust** (icebreaker, anti-cheat out of scope): proximity for kill/task/report is enforced client-side (button enabled only in range); server validates role/alive/ownership/cooldown, and trusts the `{x,y}` in the payload for body/station positions.
- **Single-instance only** (like matchmaking/game sweeps): the meeting sweep is a lifecycle `setInterval`.
- Prettier: double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. TS strict, `module: Node16`, packages ESM. Korean UI copy. B&W doodle + single dark-pink accent `#C2185B`.
- Build order before running: `@mingle/shared` → `@mingle/client-core` → apps. Shared must emit ESM+CJS.
- `grep "error TS"` false-zeroes on ANSI; grep `"Found N error"` or strip ANSI (`sed 's/\x1b\[[0-9;]*m//g'`).

---

## Task 1: Shared `Among*` types

**Files:**
- Create: `packages/shared/src/types/among.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared` builds (ESM+CJS); type-only, no runtime test needed.

**Interfaces — Produces** (verbatim, consumed by every later task):
```ts
export type AmongRole = "crew" | "impostor";
export type AmongPhase = "playing" | "meeting" | "voting" | "ended";
export type AmongTaskKind = "wires" | "sequence" | "hold" | "timing";
export interface AmongTaskView { taskId: string; kind: AmongTaskKind; x: number; y: number; done: boolean; }
export interface AmongPlayerView { profileId: string; name: string; alive: boolean; role: AmongRole | null; }
export interface AmongBodyView { profileId: string; x: number; y: number; }
export interface AmongMeetingView {
  reason: "report" | "emergency"; calledBy: string; bodyProfileId?: string;
  phase: "discussion" | "voting"; endsAt: number;
  votedProfileIds: string[]; tally?: Record<string, number>;
}
export interface AmongResultView { winner: AmongRole; reason: "tasks" | "ejected" | "kills"; }
export interface AmongSnapshot {
  sessionId: string; phase: AmongPhase; myRole: AmongRole | null; myProfileId: string;
  players: AmongPlayerView[]; myTasks: AmongTaskView[]; progress: { done: number; total: number };
  bodies: AmongBodyView[]; killCooldownUntil: number | null;
  meeting: AmongMeetingView | null;
  lastEjected: { profileId: string; role: AmongRole; wasSkip: boolean } | null;
  result: AmongResultView | null;
}
export interface AmongStateEvent { partyId: string; snapshot: AmongSnapshot | null; }
```

- [ ] Step 1: Create `types/among.ts` with the block above (add `.js` extension in any intra-file imports per Node16 ESM; there are none here).
- [ ] Step 2: In `index.ts`, add `export type { AmongRole, AmongPhase, AmongTaskKind, AmongTaskView, AmongPlayerView, AmongBodyView, AmongMeetingView, AmongResultView, AmongSnapshot, AmongStateEvent } from "./types/among.js";` (mirror the existing party.js export style).
- [ ] Step 3: `pnpm --filter @mingle/shared build` — expect clean ESM (`dist/`) + CJS (`dist/cjs/`). Verify `dist/types/among.d.ts` exists.
- [ ] Step 4: Commit `feat(shared): Among Us snapshot types`.

---

## Task 2: `AmongConfigProvider` (env validation)

**Files:**
- Create: `apps/backend/src/party/among.config.ts`
- Test: `apps/backend/src/party/among.config.spec.ts`

**Interfaces — Consumes:** the `intOr`/`floatOr` idea from `matchmaking/matchmaking.config.ts` (reimplement locally; do not import across modules). **Produces:**
```ts
export interface AmongConfig {
  minPlayers: number; impostors: number; tasksPerCrew: number;
  killRange: number; taskRange: number; killCooldownMs: number;
  discussionMs: number; voteMs: number; emergencyPerPlayer: number; sweepMs: number;
}
@Injectable() export class AmongConfigProvider { readonly value: AmongConfig; constructor(config: ConfigService) {...} }
```

Defaults/bounds (from spec): `AMONG_MIN_PLAYERS`(4,≥2) · `AMONG_IMPOSTORS`(1,≥1) · `AMONG_TASKS_PER_CREW`(3,≥1) · `AMONG_KILL_RANGE`(0.12, float in (0,1]) · `AMONG_TASK_RANGE`(0.10, (0,1]) · `AMONG_KILL_COOLDOWN_MS`(20000,≥1000) · `AMONG_DISCUSSION_MS`(30000,≥3000) · `AMONG_VOTE_MS`(30000,≥3000) · `AMONG_EMERGENCY_PER_PLAYER`(1,≥0) · `AMONG_SWEEP_MS`(1000,≥250). Use a `floatUnit(raw, def)` helper: finite & `>0 && <=1` else def.

- [ ] Step 1: Write `among.config.spec.ts` — asserts all defaults with empty env; asserts clamps (e.g. `AMONG_KILL_RANGE=5` → 0.12; `AMONG_MIN_PLAYERS=1` → 4; negative/NaN → default). Use a fake `ConfigService` (`{ get: (k) => map[k] }`).
- [ ] Step 2: Run — FAIL (module missing).
- [ ] Step 3: Implement `among.config.ts`.
- [ ] Step 4: `pnpm --filter @mingle/backend test -- among.config` → PASS.
- [ ] Step 5: Commit `feat(backend): AmongConfigProvider env validation`.

---

## Task 3: `AmongService` — start / doTask / project / task-win

**Files:**
- Create: `apps/backend/src/party/among.service.ts`
- Test: `apps/backend/src/party/among.service.spec.ts`

**Interfaces — Consumes:** `AmongConfigProvider` (Task 2), `PrismaService`, shared `AmongSnapshot`/`AmongRole` (Task 1), `Prisma.TransactionClient`. Mirror `GameService`: `lockParty(tx, partyId)`, `findActive(tx, partyId)` filtered by `gameType:"among"`. **Produces** (server-only authoritative state + public methods):
```ts
// server-only (this file):
interface AmongState {
  players: { profileId: string; name: string; role: AmongRole; alive: boolean; isBot: boolean;
             killCooldownUntil: number | null; emergencyUsed: number }[];
  tasks: { taskId: string; profileId: string; kind: AmongTaskKind; x: number; y: number; done: boolean }[];
  bodies: { profileId: string; x: number; y: number; reported: boolean }[];
  meeting: { reason: "report"|"emergency"; calledBy: string; bodyProfileId?: string;
             discussionEndsAt: number; voteEndsAt: number; votes: Record<string,string> } | null;
  lastEjected: { profileId: string; role: AmongRole; wasSkip: boolean } | null;
  phase: AmongPhase; result: AmongResultView | null;
}
@Injectable() export class AmongService {
  start(partyId: string, roster: { profileId: string; isBot?: boolean }[]): Promise<AmongState>;
  doTask(partyId: string, profileId: string, taskId: string): Promise<AmongState>;
  current(partyId: string): Promise<AmongState | null>;
  end(partyId: string): Promise<AmongState>;
  project(state: AmongState | null, viewerProfileId: string): AmongSnapshot | null; // pure, lock-free
}
```
- `start`: roster length < `minPlayers` → `BadRequestException("not-enough-players")`; active session (any gameType) → `ConflictException("already-active")` (+ P2002 backstop). Impostor count = `min(config.impostors, floor((n-1)/2))`, ≥1. Random impostor pick + role assign. Names via `prisma.profile.findMany`. Tasks: per crew, `tasksPerCrew` × `{taskId: cuid-ish, kind: rotate/random of 4, x,y: random in [margin,1-margin]}`. `phase="playing"`. Persist `gameSession.create`.
- `doTask`: lock+load active; `phase==="playing"`; task owned by caller & `!done` else `BadRequestException("invalid")`; mark done; if every task done → `result={winner:"crew",reason:"tasks"}`, `phase="ended"`, persist `status:"ended"`,`endedAt`,`result`.
- `project`: redact — `myRole` = viewer's role (or null if not a player); `players[].role` = actual only when `state.phase==="ended"` else null; `myTasks` = tasks where `profileId===viewer && `... map to `AmongTaskView`; `progress={done: tasks.filter(done).length, total: tasks.length}`; `bodies`→view; `killCooldownUntil` = viewer's; `meeting`→view (map inner phase/endsAt/votedProfileIds; `tally` only when phase voting-ended… keep undefined here, Task 5 fills reveal); `result`, `lastEjected` passthrough.

- [ ] Step 1: Write `among.service.spec.ts` covering: start with 4 roster → 1 impostor, 3 crew, 9 tasks (3×3), phase playing; start with 3 → not-enough-players; start twice → already-active; impostor clamp (roster 4, config impostors 3 → 1); doTask marks done + progress; doTask all tasks → crew win ended; doTask non-owner/foreign task → invalid; `project` hides other roles while playing, reveals at ended, gives only my tasks. Mock Prisma (a small in-memory `gameSession` + `profile.findMany`). Follow the mocking style already in `game.service.spec.ts`.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement `among.service.ts` (start/doTask/current/end/project + lockParty/findActive/toState helpers). Use `Math.random` for impostor pick + task positions (backend, allowed).
- [ ] Step 4: `pnpm --filter @mingle/backend test -- among.service` → PASS.
- [ ] Step 5: Commit `feat(backend): AmongService start/doTask/project + crew task-win`.

---

## Task 4: `AmongService` — kill / meeting / vote / resolve / sweep

**Files:**
- Modify: `apps/backend/src/party/among.service.ts`
- Modify: `apps/backend/src/party/among.service.spec.ts`

**Interfaces — Produces** (added methods):
```ts
kill(partyId, profileId, targetProfileId, x, y): Promise<AmongState>;
report(partyId, profileId, bodyProfileId): Promise<AmongState>;
emergency(partyId, profileId): Promise<AmongState>;
vote(partyId, profileId, target: string /* profileId | "skip" */): Promise<AmongState>;
sweepMeetings(): Promise<string[]>; // partyIds whose phase advanced; lock-per-party internally
```
Logic per spec §상태기계: `kill` (alive impostor, cooldown, alive-crew target, in-payload x,y → body; impostor-win check `aliveImpostors>=aliveCrew`). `report`/`emergency` → set `meeting`, `phase="meeting"`. `vote` requires `phase==="voting"`; record; if all alive voted → `resolveMeeting`. `resolveMeeting` (private): tally incl `"skip"`; strict plurality non-skip → eject (`alive=false`, `lastEjected`); tie/skip → no eject; win checks; else `phase="playing"`, `meeting=null`, reset every alive impostor `killCooldownUntil=now`. `sweepMeetings`: scan active among sessions; `meeting && phase==="meeting" && now>=discussionEndsAt` → `phase="voting"`; `phase==="voting" && now>=voteEndsAt` → `resolveMeeting`; each under its own advisory-lock tx; return changed partyIds. Extend `project` to populate `meeting.phase/endsAt` from top-level phase and include `tally` + `lastEjected` appropriately (tally shown once `phase` left voting via lastEjected, i.e. include tally in the transient state right after resolve — simplest: `project` derives `votedProfileIds` from `meeting.votes` keys; `tally` computed only when caller passes an ended-meeting — keep MVP: expose `votedProfileIds` always, `tally` undefined; reveal is carried by `lastEjected`).

- [ ] Step 1: Add specs: kill by crew → invalid; kill off-cooldown → body created + cooldown set; kill until impostors≥crew → impostor win; report on unreported body → meeting; emergency over limit → invalid; vote in playing → invalid; all alive vote → resolve+eject plurality; tie → no eject; eject last impostor → crew win; `sweepMeetings` flips meeting→voting after discussion deadline and voting→resolve after vote deadline (inject `now` via a `Date.now` seam or pass deadlines in the past through crafted state).
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement the added methods; refactor win-check into a private `checkWin(state)` used by doTask/kill/resolve.
- [ ] Step 4: `pnpm --filter @mingle/backend test -- among.service` → PASS (Task 3 + 4 specs).
- [ ] Step 5: Commit `feat(backend): AmongService kill/meeting/vote/resolve + sweep`.

---

## Task 5: PartyGateway `among:*` events + personalized broadcast + sweep wiring

**Files:**
- Modify: `apps/backend/src/party/party.gateway.ts`
- Modify: `apps/backend/src/party/party.module.ts` (add `AmongService`, `AmongConfigProvider` to providers)
- Modify: `apps/backend/src/party/party.gateway.spec.ts`

**Interfaces — Consumes:** `AmongService` (Tasks 3-4), presence map `partyId→Map<socketId,profileId>`, `authorize(client, partyId)`, `gameErrorMessage`. **Produces:** in `among:start|task|kill|report|emergency|vote|sync|end`; out `among:state {partyId, snapshot}`.
- Add `private broadcastAmong(partyId, state)`: for each `[socketId, viewerId]` in `presence.get(partyId) ?? []`, `this.server.to(socketId).emit("among:state", { partyId, snapshot: this.among.project(state, viewerId) })`.
- `among:start`: roster = `[...presence.get(partyId)?.values() ?? []]` mapped to `{profileId, isBot:false}` deduped; `await among.start(...)` → `broadcastAmong`. (Bots register their own presence via `party:join`, so they appear in roster.)
- `among:sync`: `among.current` → emit only to `client` with `among.project(state, me)`.
- others → call service, `broadcastAmong`. Errors → `client.emit("party:error", { message: gameErrorMessage(e) })` (add `"not-enough-players"` passthrough to `gameErrorMessage`).
- **Sweep**: in `afterInit()` (gateway lifecycle), `setInterval(async () => { for (const pid of await this.among.sweepMeetings()) { const st = await this.among.current(pid); if (st) this.broadcastAmong(pid, st); } }, config.sweepMs)`; clear in `onModuleDestroy`. Inject `AmongConfigProvider` for the interval.

- [ ] Step 1: Add gateway specs (mirror existing `party.gateway.spec.ts`): non-participant `among:start` → `party:error forbidden`; participant `among:start` with enough roster → `among:state` emitted per socket with role hidden for non-self; `among:sync` answers only caller; error mapping for `not-enough-players`. Mock `AmongService`.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement handlers + `broadcastAmong` + sweep; wire module providers.
- [ ] Step 4: `pnpm --filter @mingle/backend test -- party.gateway` → PASS; then full `pnpm --filter @mingle/backend build` clean + `pnpm --filter @mingle/backend test` green.
- [ ] Step 5: Commit `feat(backend): PartyGateway among:* events + personalized broadcast + meeting sweep`.

---

## Task 6: client-core party-socket among methods + `onAmongState`

**Files:**
- Modify: `packages/client-core/src/socket/party-socket.ts`
- Test: `packages/client-core/src/__tests__/among-socket.test.ts` (new; mirror `party-realtime.test.ts`)

**Interfaces — Consumes:** shared `AmongStateEvent` (Task 1). **Produces:** on `PartySocketHandle` add `startAmong(partyId)`, `doAmongTask(partyId, taskId, x, y)`, `killAmong(partyId, targetProfileId, x, y)`, `reportAmong(partyId, bodyProfileId)`, `emergencyAmong(partyId)`, `voteAmong(partyId, target)`, `syncAmong(partyId)`, `endAmong(partyId)`; on `PartySocketHandlers` add `onAmongState?: (e: AmongStateEvent) => void` wired to socket event `among:state`.

- [ ] Step 1: Write test: a fake socket records `emit(event,payload)` and lets tests fire listeners; assert each handle method emits the right event+payload; assert `onAmongState` fires on `among:state`.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement (mirror existing `startGame`/`onGameState` wiring).
- [ ] Step 4: `pnpm --filter @mingle/client-core build && pnpm --filter @mingle/client-core test` → PASS.
- [ ] Step 5: Commit `feat(client-core): party-socket Among methods + onAmongState`.

---

## Task 7: Mobile pure lib `among.ts` (proximity + action selection)

**Files:**
- Create: `apps/mobile/src/lib/among.ts`
- Test: `apps/mobile/src/lib/__tests__/among.test.ts`

**Interfaces — Consumes:** `Vec2` from `party-space`, shared `AmongSnapshot`. **Produces:**
```ts
export function dist(a: Vec2, b: Vec2): number;
export function nearestTask(myPos: Vec2, tasks: AmongTaskView[], range: number): AmongTaskView | null; // undone only
export function nearestKillTarget(myPos: Vec2, players: AmongPlayerView[], positions: Record<string,Vec2>, range: number): AmongPlayerView | null; // alive, not me
export function nearbyBody(myPos: Vec2, bodies: AmongBodyView[], range: number): AmongBodyView | null; // unreported
export const RANGE = { task: 0.10, kill: 0.12 }; // client mirror of server defaults
```
- [ ] Step 1: Write vitest: dist correctness; nearestTask ignores done + out-of-range; nearestKillTarget excludes self/dead/out-of-range; nearbyBody picks closest unreported.
- [ ] Step 2: Run → FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: `pnpm --filter @mingle/mobile test -- among` → PASS.
- [ ] Step 5: Commit `feat(mobile): among proximity/action pure lib`.

---

## Task 8: Mobile minigames (4 components)

**Files:**
- Create: `apps/mobile/src/components/among/minigames/Wires.tsx`, `Sequence.tsx`, `Hold.tsx`, `Timing.tsx`, `index.tsx` (a `MiniGame` switch by `AmongTaskKind`)
- Test: `apps/mobile/src/lib/__tests__/minigame-logic.test.ts` (extract pure logic where feasible: sequence order check, wires pair-match check)

**Interfaces — Produces:** each component `({ onComplete }: { onComplete: () => void }) => JSX`; `MiniGame({ kind, onComplete })` dispatches. B&W doodle, plain RN Views, no new deps. Symbols for wires (★●▲■) — never color.
- Wires: 4 left / 4 right shuffled symbols; tap-left-then-right pairs; all matched → `onComplete`.
- Sequence: numbers 1..6 scattered; ascending taps; wrong → reset; last → `onComplete`.
- Hold: press-and-hold a button; a progress value rises ~2s (rAF/interval); reaches 1 → `onComplete`; release resets to hold-in-place (MVP: pause).
- Timing: a marker sweeps 0..1..0; tap when in `[0.4,0.6]`; 3 hits → `onComplete`.

- [ ] Step 1: Write tests for the extractable pure helpers (`nextSequenceIndex`, `wiresAllMatched`) → FAIL.
- [ ] Step 2: Implement helpers + the 4 components + `MiniGame` switch.
- [ ] Step 3: `pnpm --filter @mingle/mobile test` → PASS; `pnpm --filter @mingle/mobile exec tsc --noEmit` clean (strip ANSI when checking).
- [ ] Step 4: Commit `feat(mobile): 4 Among task minigames (B&W)`.

---

## Task 9: Mobile Among UI — map, role reveal, meeting, result, orchestrator + party wiring

**Files:**
- Create: `apps/mobile/src/components/among/AmongMap.tsx`, `RoleReveal.tsx`, `MeetingScreen.tsx`, `ResultScreen.tsx`, `AmongGame.tsx`
- Modify: `apps/mobile/app/(app)/party/[id].tsx`

**Interfaces — Consumes:** `PartySocketHandle` among methods + `onAmongState` (Task 6), `among.ts` lib (Task 7), `MiniGame` (Task 8), existing `posRef`/rAF loop/`party:move`. **Produces:** `AmongGame` orchestrator rendered in the party screen game area; consumes `AmongSnapshot` state + live positions.
- `AmongMap`: reuse positioning math; render other players (from `posRef`), my task stations (undone markers), bodies (X), my avatar (gray if dead). Tap → move (existing `onTapMove`).
- `AmongGame`: holds `among` snapshot (via `onAmongState`), calls `syncAmong` on mount; shows "어몽어스 시작" when none; on playing shows RoleReveal(3s) then map + context action bar (미션수행→MiniGame modal→`doAmongTask`; 킬→`killAmong`; 신고→`reportAmong`; 긴급회의→`emergencyAmong`) + progress gauge; on meeting/voting shows `MeetingScreen` (discussion timer / vote list → `voteAmong`); on ended shows `ResultScreen` + 다시하기 (`endAmong` then `startAmong`).
- party/[id].tsx: import + render `<AmongGame handle={socketRef} partyId={id} myProfileId posRef .../>` next to the balance card; wire `onAmongState` into the existing `open...`/handlers block.

- [ ] Step 1: Implement components + wiring (UI task — no unit test; gated by tsc + Task 11 E2E). Keep balance game working.
- [ ] Step 2: `pnpm --filter @mingle/mobile exec tsc --noEmit` → 0 errors (strip ANSI). `pnpm --filter @mingle/mobile test` still green.
- [ ] Step 3: Commit `feat(mobile): Among Us game UI (map/role/meeting/result) wired into party`.

---

## Task 10: AI bot players `tools/among-bots.mjs`

**Files:**
- Create: `tools/among-bots.mjs`

**Interfaces — Consumes:** running backend + a party id + bot credentials. Uses `socket.io-client` (already a backend dep; resolve from `apps/backend/node_modules` or repo root). **Produces:** a runner: `node tools/among-bots.mjs <partyId> <count>` (env `BASE`, tokens fetched by registering bots and matching, OR accept a JSON of `{token}` list). Each bot: connect socket w/ `auth.token`, `party:join`, subscribe `among:state`; on playing → role-based `party:move` stepping + `among:task`(crew, on range, ~1s delay) / `among:kill`(impostor, on range+cooldown); on `voting` → `among:vote`. Reuse `party-space` stepping math (inline copy — mjs can't import TS).
- [ ] Step 1: Implement runner + a helper that spawns N bots that reach the same party (register → profile → matchmaking, mirroring `matchbot.mjs`), or accept an existing partyId + tokens.
- [ ] Step 2: Smoke: `node tools/among-bots.mjs --help` runs; against a live party, bots connect + emit (verified in Task 11).
- [ ] Step 3: Commit `feat(tools): among-bots AI player runner`.

---

## Task 11: E2E — live bot round + browser play + CLAUDE.md

**Files:**
- Create: `$CLAUDE_JOB_DIR/tmp/among-e2e.mjs` (scratch; not committed)
- Modify: `CLAUDE.md` (Phase 6d status/env/events), `apps/mobile/.env`-independent

- [ ] Step 1: Build all (`shared→client-core`), restart backend, form a 4-member party (dev + 3 bots via matchmaking). Run `among-bots` + a driver that: starts the game, drives to (a) a crew-win (all tasks) and (b) an impostor-win (kills), asserting `result.winner` via a bot's snapshot. Capture pass/fail counts.
- [ ] Step 2: Browser (Playwright): dev account (token-injected) + 3 bots; click 어몽어스 시작 → role reveal → do a minigame → (if impostor) kill / (if crew) tasks → trigger a meeting → vote → result. Screenshot each phase.
- [ ] Step 3: Update `CLAUDE.md`: Phase 6d section (among gameType, events, `AMONG_*` env, personalized snapshot, sweep, bots), and the party-space/game notes.
- [ ] Step 4: Final whole-branch review (subagent) → fix Critical/Important → commit `feat: Phase 6d Among Us — E2E verified + docs`.

---

## Self-Review Notes
- Spec coverage: roles(T3)·minigame tasks(T8)·kill(T4)·report/emergency/meeting/vote/resolve(T4)·timers/sweep(T4/T5)·personalized snapshot(T3/T5)·movement reuse(T9)·bots(T10)·win conditions(T3/T4)·config(T2)·types(T1)·E2E(T11). ✓
- Type consistency: `AmongState` (server) vs `AmongSnapshot` (client) kept distinct; `project()` is the only bridge. Method names match across T3/T4/T5/T6/T9.
- No placeholders; each task independently testable (T9/T10 gated by tsc + T11 E2E as they are UI/ops).
