# Phase 6c: 밸런스 게임 Icebreaker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first icebreaker minigame (this-or-that "밸런스 게임") in the live party room — start/vote/reveal/advance over the 6a party gateway, persisted in the existing `GameSession` model, with a B&W game card in the mobile party screen.

**Architecture:** `GameService` owns the whole state machine with the DB as the only state store (`GameSession.state` Json — no in-memory game state, restart-safe). The existing `PartyGateway` gains four thin handlers (it already owns presence + `authorize`). client-core's `connectPartySocket` gains game emits + an `onGameState` handler. The party screen renders a game card between the 2D room and the chat.

**Tech Stack:** NestJS 10 + Prisma (`GameSession` — NO migration), jest; `@mingle/shared`; `@mingle/client-core` (Vitest); Expo RN (tsc-gated screen).

## Global Constraints

- Events: in `game:start {partyId}` · `game:vote {partyId, choice}` · `game:sync {partyId}` · `game:end {partyId}`; out `game:state {partyId, snapshot}` (broadcast on change; single-socket on sync) + the existing `error {message}` (`forbidden` / `already-active` / `no-active-game` / `invalid`).
- One active session per party; 5 rounds; votes hidden until reveal (`votedProfileIds` only); reveal+advance when every PRESENT roster member has voted; anyone can start/force-end; `game:sync` answers only the requester.
- The DB is the state store: every handler round-trips through `GameService` → Prisma. Snapshot never leaks current-round choices.
- **Pure B&W** mobile UI; Rules of Hooks (new hooks before early returns). Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons); TS strict; ANSI-safe error greps. Never stage `.env`. Do NOT push.
- ⚠️ The existing `party.gateway.spec.ts` constructs `new PartyGateway(jwt, party)` — Task 3 adds a third constructor arg (`game`) and MUST update that spec's `gatewayWith()` accordingly.

---

### Task 1: shared game types

**Files:**
- Modify: `packages/shared/src/types/party.ts` (append)
- Modify: `packages/shared/src/index.ts` (extend the party export line)

**Interfaces — Produces:** `GameChoice = "a" | "b"`; `GameReveal { round, question: {a,b}, aVoters, bVoters }`; `GameSnapshot { sessionId, gameType: "balance", status: "active"|"ended", round, totalRounds, question: {a,b}|null, votedProfileIds, reveals }`; `GameStateEvent { partyId, snapshot: GameSnapshot | null }`.

- [ ] **Step 1: Append to `packages/shared/src/types/party.ts`**

```ts
/** Balance-game vote choice. */
export type GameChoice = "a" | "b";

/** A completed (revealed) balance-game round. */
export interface GameReveal {
  round: number;
  question: { a: string; b: string };
  aVoters: string[];
  bVoters: string[];
}

/** Public snapshot of a party's game — current-round choices stay hidden. */
export interface GameSnapshot {
  sessionId: string;
  gameType: "balance";
  status: "active" | "ended";
  round: number;
  totalRounds: number;
  question: { a: string; b: string } | null;
  votedProfileIds: string[];
  reveals: GameReveal[];
}

/** game:state payload; snapshot null = no active game (sync response). */
export interface GameStateEvent {
  partyId: string;
  snapshot: GameSnapshot | null;
}
```

- [ ] **Step 2:** extend the barrel line in `packages/shared/src/index.ts` to
`export type { PartyStatus, Party, PartyMessageView, PartyPresence, PartyMove, GameChoice, GameReveal, GameSnapshot, GameStateEvent } from "./types/party.js";`
- [ ] **Step 3:** `pnpm --filter @mingle/shared build … || echo CLEAN` → CLEAN; shared tests still 7/7.
- [ ] **Step 4: Commit** — `git add packages/shared/src/types/party.ts packages/shared/src/index.ts && git commit -m "feat(shared): balance-game snapshot types"`

---

### Task 2: `GameService` (TDD)

**Files:**
- Create: `apps/backend/src/party/game.service.ts`
- Test: `apps/backend/src/party/game.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`gameSession.findFirst/create/update`); Task 1 types.
- Produces (Task 3 relies on): `start(partyId)`, `vote(partyId, profileId, choice, presentMembers)`, `end(partyId)`, `current(partyId)` — all `Promise<GameSnapshot>` (`current` nullable); throws `ConflictException("already-active")` / `NotFoundException("no-active-game")` / `BadRequestException("invalid")`. Exports `QUESTIONS`, `TOTAL_ROUNDS = 5`.

- [ ] **Step 1: Write the failing tests** — `apps/backend/src/party/game.service.spec.ts`

```ts
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { GameService, QUESTIONS, TOTAL_ROUNDS } from "./game.service";

const prisma = {
  gameSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
} as any;

const service = new GameService(prisma);
beforeEach(() => jest.clearAllMocks());

function stateWith(partial: Partial<{ order: number[]; round: number; votes: any; reveals: any[] }>) {
  return { order: [0, 1, 2, 3, 4], round: 0, votes: {}, reveals: [], ...partial };
}
const ROW = (state: any, status = "active") => ({ id: "g1", partyId: "pt1", gameType: "balance", status, state });

describe("start", () => {
  it("creates a 5-round session and returns the first-question snapshot", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    prisma.gameSession.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));
    const snap = await service.start("pt1");
    expect(prisma.gameSession.create).toHaveBeenCalled();
    const created = prisma.gameSession.create.mock.calls[0][0].data;
    expect(created.status).toBe("active");
    expect(created.state.order).toHaveLength(TOTAL_ROUNDS);
    expect(new Set(created.state.order).size).toBe(TOTAL_ROUNDS);
    expect(snap.status).toBe("active");
    expect(snap.round).toBe(0);
    expect(snap.totalRounds).toBe(TOTAL_ROUNDS);
    expect(snap.question).toEqual(QUESTIONS[created.state.order[0]]);
    expect(snap.votedProfileIds).toEqual([]);
  });
  it("rejects when a session is already active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(ROW(stateWith({})));
    await expect(service.start("pt1")).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("vote", () => {
  it("records a hidden vote (ids only) without advancing when others haven't voted", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(ROW(stateWith({})));
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfA", "a", ["pfA", "pfB"]);
    expect(snap.round).toBe(0);
    expect(snap.votedProfileIds).toEqual(["pfA"]);
    expect(snap.reveals).toEqual([]);
    expect((snap as any).votes).toBeUndefined();
  });
  it("overwrites a re-vote", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ votes: { "0": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfA", "b", ["pfA", "pfB"]);
    expect(snap.votedProfileIds).toEqual(["pfA"]);
    expect(snap.round).toBe(0);
  });
  it("reveals and advances when every present member has voted", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ votes: { "0": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfB", "b", ["pfA", "pfB"]);
    expect(snap.round).toBe(1);
    expect(snap.reveals).toHaveLength(1);
    expect(snap.reveals[0]).toEqual({
      round: 0,
      question: QUESTIONS[0],
      aVoters: ["pfA"],
      bVoters: ["pfB"],
    });
    expect(snap.question).toEqual(QUESTIONS[1]);
    expect(snap.votedProfileIds).toEqual([]);
  });
  it("ends the game after the final round reveals", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ round: TOTAL_ROUNDS - 1, votes: { "4": { pfA: "a" } } })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.vote("pt1", "pfB", "a", ["pfA", "pfB"]);
    expect(snap.status).toBe("ended");
    expect(snap.question).toBeNull();
    const update = prisma.gameSession.update.mock.calls[0][0].data;
    expect(update.status).toBe("ended");
    expect(update.result).toHaveLength(1);
  });
  it("rejects a bad choice", async () => {
    await expect(service.vote("pt1", "pfA", "x" as any, ["pfA"])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it("rejects when no game is active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    await expect(service.vote("pt1", "pfA", "a", ["pfA"])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("end / current", () => {
  it("force-ends the active game keeping completed reveals", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(
      ROW(stateWith({ round: 2, reveals: [{ round: 0 }, { round: 1 }] as any })),
    );
    prisma.gameSession.update.mockResolvedValue({});
    const snap = await service.end("pt1");
    expect(snap.status).toBe("ended");
    expect(snap.reveals).toHaveLength(2);
    expect(snap.question).toBeNull();
  });
  it("end rejects when none active", async () => {
    prisma.gameSession.findFirst.mockResolvedValue(null);
    await expect(service.end("pt1")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("current returns the active snapshot or null", async () => {
    prisma.gameSession.findFirst.mockResolvedValueOnce(ROW(stateWith({})));
    await expect(service.current("pt1")).resolves.toMatchObject({ sessionId: "g1", round: 0 });
    prisma.gameSession.findFirst.mockResolvedValueOnce(null);
    await expect(service.current("pt1")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2:** `pnpm --filter @mingle/backend exec jest game.service …` → FAIL (module missing).

- [ ] **Step 3: Create `apps/backend/src/party/game.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { GameChoice, GameReveal, GameSnapshot } from "@mingle/shared";

export const QUESTIONS: { a: string; b: string }[] = [
  { a: "산으로 여행", b: "바다로 여행" },
  { a: "아침형 인간", b: "저녁형 인간" },
  { a: "영화관 데이트", b: "산책 데이트" },
  { a: "매운 음식", b: "단 음식" },
  { a: "강아지", b: "고양이" },
  { a: "계획적인 여행", b: "즉흥 여행" },
  { a: "전화 통화", b: "문자 메시지" },
  { a: "집에서 쉬기", b: "밖에서 놀기" },
  { a: "겨울", b: "여름" },
  { a: "혼자 취미", b: "함께 취미" },
  { a: "일찍 자고 일찍 일어나기", b: "늦게 자고 늦잠" },
  { a: "노래방", b: "보드게임 카페" },
];

export const TOTAL_ROUNDS = 5;

interface GameState {
  order: number[];
  round: number;
  votes: Record<string, Record<string, GameChoice>>;
  reveals: GameReveal[];
}

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async start(partyId: string): Promise<GameSnapshot> {
    const active = await this.findActive(partyId);
    if (active) throw new ConflictException("already-active");
    const order = shuffle([...QUESTIONS.keys()]).slice(0, TOTAL_ROUNDS);
    const state: GameState = { order, round: 0, votes: {}, reveals: [] };
    const row = await this.prisma.gameSession.create({
      data: { partyId, gameType: "balance", status: "active", state: state as unknown as object },
    });
    return this.toSnapshot(row.id, "active", state);
  }

  async vote(
    partyId: string,
    profileId: string,
    choice: GameChoice,
    presentMembers: string[],
  ): Promise<GameSnapshot> {
    if (choice !== "a" && choice !== "b") throw new BadRequestException("invalid");
    const row = await this.findActive(partyId);
    if (!row) throw new NotFoundException("no-active-game");
    const state = row.state as unknown as GameState;
    const key = String(state.round);
    state.votes[key] = { ...(state.votes[key] ?? {}), [profileId]: choice };
    const votes = state.votes[key];
    const everyoneVoted =
      presentMembers.length > 0 && presentMembers.every((pid) => votes[pid] !== undefined);
    let status: "active" | "ended" = "active";
    if (everyoneVoted) {
      const q = QUESTIONS[state.order[state.round]!]!;
      state.reveals.push({
        round: state.round,
        question: q,
        aVoters: Object.keys(votes).filter((p) => votes[p] === "a"),
        bVoters: Object.keys(votes).filter((p) => votes[p] === "b"),
      });
      state.round += 1;
      if (state.round >= TOTAL_ROUNDS) status = "ended";
    }
    await this.prisma.gameSession.update({
      where: { id: row.id },
      data: {
        state: state as unknown as object,
        status,
        ...(status === "ended"
          ? { endedAt: new Date(), result: state.reveals as unknown as object }
          : {}),
      },
    });
    return this.toSnapshot(row.id, status, state);
  }

  async end(partyId: string): Promise<GameSnapshot> {
    const row = await this.findActive(partyId);
    if (!row) throw new NotFoundException("no-active-game");
    const state = row.state as unknown as GameState;
    await this.prisma.gameSession.update({
      where: { id: row.id },
      data: { status: "ended", endedAt: new Date(), result: state.reveals as unknown as object },
    });
    return this.toSnapshot(row.id, "ended", state);
  }

  async current(partyId: string): Promise<GameSnapshot | null> {
    const row = await this.findActive(partyId);
    if (!row) return null;
    return this.toSnapshot(row.id, "active", row.state as unknown as GameState);
  }

  private findActive(partyId: string) {
    return this.prisma.gameSession.findFirst({ where: { partyId, status: "active" } });
  }

  private toSnapshot(
    sessionId: string,
    status: "active" | "ended",
    state: GameState,
  ): GameSnapshot {
    const ended = status === "ended" || state.round >= TOTAL_ROUNDS;
    const qIdx = ended ? undefined : state.order[state.round];
    return {
      sessionId,
      gameType: "balance",
      status: ended ? "ended" : "active",
      round: state.round,
      totalRounds: TOTAL_ROUNDS,
      question: qIdx === undefined ? null : (QUESTIONS[qIdx] ?? null),
      votedProfileIds: Object.keys(state.votes[String(state.round)] ?? {}),
      reveals: state.reveals,
    };
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
```

- [ ] **Step 4:** game.service jest → 11 passed; full backend suite green; build CLEAN.
- [ ] **Step 5: Commit** — `git add apps/backend/src/party/game.service.ts apps/backend/src/party/game.service.spec.ts && git commit -m "feat(party): balance-game service (start/vote/reveal/advance/end, DB-backed)"`

---

### Task 3: gateway game handlers + module wiring (TDD)

**Files:**
- Modify: `apps/backend/src/party/party.gateway.ts`
- Modify: `apps/backend/src/party/party.gateway.spec.ts` (⚠️ update `gatewayWith()` for the new ctor arg + add game tests)
- Modify: `apps/backend/src/party/party.module.ts` (providers += `GameService`)

**Interfaces:**
- Consumes: Task 2's `GameService`; the gateway's existing `authorize` + presence map.
- Produces: events `game:start|game:vote|game:sync|game:end` in, `game:state {partyId, snapshot}` out. Tasks 4–5 hardcode these.

- [ ] **Step 1: extend the spec** — in `party.gateway.spec.ts`, add a `game` mock + pass it as the third ctor arg:

```ts
const game = {
  start: jest.fn(),
  vote: jest.fn(),
  end: jest.fn(),
  current: jest.fn(),
} as any;

function gatewayWith() {
  const gw = new PartyGateway(jwt, party, game);
  (gw as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  return gw;
}
```

and append these tests:

```ts
it("game:start broadcasts the snapshot to the room", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "active" };
  game.start.mockResolvedValueOnce(snap);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(to).toHaveBeenCalledWith("pt1");
  expect(to.mock.results[0].value.emit).toHaveBeenCalledWith("game:state", {
    partyId: "pt1",
    snapshot: snap,
  });
});

it("game:start maps a Conflict to an already-active error emit", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const { ConflictException } = require("@nestjs/common");
  game.start.mockRejectedValueOnce(new ConflictException("already-active"));
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("error", { message: "already-active" });
});

it("game:vote passes the present roster and broadcasts", async () => {
  party.assertParticipant.mockResolvedValue("pf1");
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleJoin(client, { partyId: "pt1" });
  const snap = { sessionId: "g1" };
  game.vote.mockResolvedValueOnce(snap);
  await gw.handleGameVote(client, { partyId: "pt1", choice: "a" });
  expect(game.vote).toHaveBeenCalledWith("pt1", "pf1", "a", ["pf1"]);
  const lastEmit = to.mock.results.at(-1)!.value.emit;
  expect(lastEmit).toHaveBeenCalledWith("game:state", { partyId: "pt1", snapshot: snap });
});

it("game:sync answers only the requesting socket", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  game.current.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameSync(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("game:state", { partyId: "pt1", snapshot: null });
  expect((gw as any).server.to).not.toHaveBeenCalled();
});

it("game:end broadcasts the ended snapshot", async () => {
  party.assertParticipant.mockResolvedValueOnce("pf1");
  const snap = { sessionId: "g1", status: "ended" };
  game.end.mockResolvedValueOnce(snap);
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  const client = clientWith("u1");
  await gw.handleGameEnd(client, { partyId: "pt1" });
  expect(to.mock.results.at(-1)!.value.emit).toHaveBeenCalledWith("game:state", {
    partyId: "pt1",
    snapshot: snap,
  });
});

it("game handlers refuse non-participants", async () => {
  party.assertParticipant.mockResolvedValueOnce(null);
  const gw = gatewayWith();
  const client = clientWith("u1");
  await gw.handleGameStart(client, { partyId: "pt1" });
  expect(client.emit).toHaveBeenCalledWith("error", { message: "forbidden" });
  expect(game.start).not.toHaveBeenCalled();
});
```

- [ ] **Step 2:** run `jest party.gateway` → FAIL (handlers missing).

- [ ] **Step 3: extend `party.gateway.ts`** — imports gain:

```ts
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { GameChoice } from "@mingle/shared";
import { GameService } from "./game.service";
```

constructor gains `private readonly game: GameService,` (third param). Add the handlers + helpers inside the class:

```ts
  @SubscribeMessage("game:start")
  async handleGameStart(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const snapshot = await this.game.start(body.partyId);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("game:vote")
  async handleGameVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { partyId: string; choice: GameChoice },
  ) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const roster = [...new Set(this.presence.get(body.partyId)?.values() ?? [])];
      const snapshot = await this.game.vote(body.partyId, me, body.choice, roster);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("error", { message: this.gameErrorMessage(e) });
    }
  }

  @SubscribeMessage("game:sync")
  async handleGameSync(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    const snapshot = await this.game.current(body.partyId);
    client.emit("game:state", { partyId: body.partyId, snapshot });
  }

  @SubscribeMessage("game:end")
  async handleGameEnd(@ConnectedSocket() client: Socket, @MessageBody() body: { partyId: string }) {
    const me = await this.authorize(client, body?.partyId);
    if (!me) return;
    try {
      const snapshot = await this.game.end(body.partyId);
      this.server.to(body.partyId).emit("game:state", { partyId: body.partyId, snapshot });
    } catch (e) {
      client.emit("error", { message: this.gameErrorMessage(e) });
    }
  }

  private gameErrorMessage(e: unknown): string {
    if (e instanceof ConflictException) return "already-active";
    if (e instanceof NotFoundException) return "no-active-game";
    if (e instanceof BadRequestException) return "invalid";
    return "invalid";
  }
```

- [ ] **Step 4:** `party.module.ts` providers → `[PartyService, PartyGateway, GameService]` (import `GameService`).
- [ ] **Step 5:** party suites green (service 8 + gateway 16 + game 11); FULL backend suite green; build CLEAN; boot check (Nest starts).
- [ ] **Step 6: Commit** — `git add apps/backend/src/party/party.gateway.ts apps/backend/src/party/party.gateway.spec.ts apps/backend/src/party/party.module.ts && git commit -m "feat(party): balance-game gateway events (start/vote/sync/end)"`

---

### Task 4: client-core game events

**Files:**
- Modify: `packages/client-core/src/socket/party-socket.ts`
- Modify: `packages/client-core/src/index.ts` (type re-exports)
- Test: `packages/client-core/src/__tests__/party-realtime.test.ts` (extend)

**Interfaces:**
- Produces: `PartySocketHandlers` += `onGameState?: (e: GameStateEvent) => void`; `PartySocketHandle` += `startGame(partyId)`, `voteGame(partyId, choice: GameChoice)`, `syncGame(partyId)`, `endGame(partyId)`.

- [ ] **Step 1: extend the test file** — append to `party-realtime.test.ts`:

```ts
describe("game events", () => {
  it("emits game:start / game:vote / game:sync / game:end with correct payloads", () => {
    const emitted: unknown[][] = [];
    const mockSocket = { on: vi.fn(), emit: (...a: unknown[]) => emitted.push(a), disconnect: vi.fn() };
    const handle = connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: {},
    });
    handle.startGame("pt1");
    handle.voteGame("pt1", "a");
    handle.syncGame("pt1");
    handle.endGame("pt1");
    expect(emitted).toEqual([
      ["game:start", { partyId: "pt1" }],
      ["game:vote", { partyId: "pt1", choice: "a" }],
      ["game:sync", { partyId: "pt1" }],
      ["game:end", { partyId: "pt1" }],
    ]);
  });

  it("wires onGameState to game:state", () => {
    const listeners = new Map<string, (e: unknown) => void>();
    const mockSocket = {
      on: (ev: string, fn: (e: unknown) => void) => listeners.set(ev, fn),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };
    const onGameState = vi.fn();
    connectPartySocket({
      ioFactory: vi.fn().mockReturnValue(mockSocket),
      baseUrl: "",
      token: "",
      handlers: { onGameState },
    });
    listeners.get("game:state")!({ partyId: "pt1", snapshot: null });
    expect(onGameState).toHaveBeenCalledWith({ partyId: "pt1", snapshot: null });
  });
});
```

- [ ] **Step 2:** run → FAIL. **Step 3: implement** — in `party-socket.ts`: import `GameChoice, GameStateEvent` types; handlers interface += `onGameState?: (e: GameStateEvent) => void;`; handle interface += the four methods; destructure `onGameState`; register `if (onGameState) socket.on("game:state", onGameState);`; return object += 

```ts
    startGame: (partyId) => socket.emit("game:start", { partyId }),
    voteGame: (partyId, choice) => socket.emit("game:vote", { partyId, choice }),
    syncGame: (partyId) => socket.emit("game:sync", { partyId }),
    endGame: (partyId) => socket.emit("game:end", { partyId }),
```

- [ ] **Step 4:** barrel — extend the shared type re-export line to include `GameSnapshot, GameReveal, GameChoice, GameStateEvent`.
- [ ] **Step 5:** client-core suite green (59); build CLEAN. **Step 6: Commit** — `git add packages/client-core/src/socket/party-socket.ts packages/client-core/src/index.ts packages/client-core/src/__tests__/party-realtime.test.ts && git commit -m "feat(client-core): balance-game socket events"`

---

### Task 5: mobile game card

**Files:**
- Modify: `apps/mobile/app/(app)/party/[id].tsx`

**Interfaces:**
- Consumes: `type GameSnapshot, type GameChoice` from `@mingle/client-core`; the existing socket handle (`startGame/voteGame/syncGame/endGame`) + handlers.

- [ ] **Step 1: imports** — add `type GameSnapshot` and `type GameChoice` to the existing `@mingle/client-core` import.
- [ ] **Step 2: state** (before early returns): `const [game, setGame] = useState<GameSnapshot | null>(null);` and `const [myVote, setMyVote] = useState<GameChoice | null>(null);`
- [ ] **Step 3: socket effect** — handlers += 

```tsx
      onGameState: (e) => {
        if (!alive) return;
        setGame((prev) => (e.snapshot ? e.snapshot : prev && prev.status === "ended" ? prev : null));
        if (e.snapshot && e.snapshot.status === "active") {
          setMyVote((prev) => (e.snapshot!.votedProfileIds.includes(myProfileId ?? "") ? prev : null));
        }
      },
```

and after `handle.joinParty(id)` add `handle.syncGame(id);`.

- [ ] **Step 4: actions** (plain functions):

```tsx
  function onStartGame() {
    socketRef.current?.startGame(id!);
  }
  function onVote(choice: GameChoice) {
    setMyVote(choice);
    socketRef.current?.voteGame(id!, choice);
  }
  function onEndGame() {
    socketRef.current?.endGame(id!);
  }
```

- [ ] **Step 5: JSX** — between the room section and the chat section:

```tsx
      <View style={styles.gameSection}>
        <View style={styles.gameHeader}>
          <Text style={styles.gameTitle}>밸런스 게임</Text>
          {game?.status === "active" ? (
            <Pressable onPress={onEndGame} hitSlop={8}>
              <Text style={styles.gameEnd}>게임 종료</Text>
            </Pressable>
          ) : null}
        </View>
        {!game ? (
          <Pressable style={styles.gameStartBtn} onPress={onStartGame}>
            <Text style={styles.gameStartText}>밸런스 게임 시작</Text>
          </Pressable>
        ) : game.status === "active" && game.question ? (
          <>
            <Text style={styles.gameRound}>
              {game.round + 1}/{game.totalRounds} 라운드 · {game.votedProfileIds.length}명 투표 완료
            </Text>
            <View style={styles.gameChoices}>
              <Pressable
                style={[styles.gameChoice, myVote === "a" && styles.gameChoiceMine]}
                onPress={() => onVote("a")}
              >
                <Text style={[styles.gameChoiceText, myVote === "a" && styles.gameChoiceTextMine]}>
                  {game.question.a}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.gameChoice, myVote === "b" && styles.gameChoiceMine]}
                onPress={() => onVote("b")}
              >
                <Text style={[styles.gameChoiceText, myVote === "b" && styles.gameChoiceTextMine]}>
                  {game.question.b}
                </Text>
              </Pressable>
            </View>
            {game.reveals.length > 0 ? (
              <Text style={styles.gameReveal}>
                지난 라운드: {game.reveals.at(-1)!.question.a} {game.reveals.at(-1)!.aVoters.length}
                표 vs {game.reveals.at(-1)!.question.b} {game.reveals.at(-1)!.bVoters.length}표
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.gameRound}>게임 결과</Text>
            {game.reveals.map((r) => (
              <Text key={r.round} style={styles.gameReveal}>
                {r.question.a} {r.aVoters.length}표 vs {r.question.b} {r.bVoters.length}표
              </Text>
            ))}
            <Pressable style={styles.gameStartBtn} onPress={onStartGame}>
              <Text style={styles.gameStartText}>다시 하기</Text>
            </Pressable>
          </>
        )}
      </View>
```

(ensure `Pressable` is imported from react-native — add it to the existing import list if absent.)

- [ ] **Step 6: styles** (B&W only):

```tsx
  gameSection: { borderWidth: 2, borderColor: "#17150F", borderRadius: 10, padding: 12, gap: 8 },
  gameHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameTitle: { fontSize: 15, fontWeight: "700", color: "#17150F" },
  gameEnd: { fontSize: 12, color: "#8A857C", textDecorationLine: "underline" },
  gameRound: { fontSize: 12, color: "#45413A" },
  gameChoices: { flexDirection: "row", gap: 8 },
  gameChoice: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#17150F",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  gameChoiceMine: { backgroundColor: "#17150F" },
  gameChoiceText: { color: "#17150F", fontWeight: "700", fontSize: 13, textAlign: "center" },
  gameChoiceTextMine: { color: "#FFFFFF" },
  gameStartBtn: {
    borderWidth: 2,
    borderColor: "#17150F",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  gameStartText: { color: "#17150F", fontWeight: "700", fontSize: 14 },
  gameReveal: { fontSize: 12, color: "#8A857C" },
```

- [ ] **Step 7:** tsc CLEAN; mobile vitest 22/22; iOS bundle smoke exit 0.
- [ ] **Step 8: Commit** — `git add "apps/mobile/app/(app)/party/[id].tsx" && git commit -m "feat(mobile): balance-game card in the party room"`

---

## Plan Self-Review

**Spec coverage:** types (T1); service state machine incl. hidden votes/reveal/advance/end/current + DB-as-state-store (T2); the four gateway events + error mapping + roster injection + spec-ctor fix (T3); client-core emits/handler (T4); mobile card w/ sync-on-join, vote UX, reveal, summary, restart (T5). Live E2E extension = controller-run (not a plan task). No migration (GameSession exists). Gaps: none.

**Placeholder scan:** none.

**Type consistency:** `GameSnapshot`/`GameChoice`/`GameStateEvent` names identical across T1–T5; `vote(partyId, profileId, choice, presentMembers)` matches the gateway call; `game:state {partyId, snapshot}` payload identical in T3/T4/T5; handle methods `startGame/voteGame/syncGame/endGame` identical in T4/T5.
