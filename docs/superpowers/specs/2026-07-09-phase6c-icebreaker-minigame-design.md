# Phase 6c: Icebreaker Minigame — 밸런스 게임 (Balance Game) — Design

**Date:** 2026-07-09
**Status:** Approved design (pre-plan; sub-decisions defaulted under the standing /goal directive)
**Branch:** `megahuni`

## Goal

The first icebreaker minigame in the live party room (`DEVELOPMENT_PLAN §3.5`: "MVP 1~2종 먼저, 게임 타입 플러그형"): a **밸런스 게임** (this-or-that). Anyone starts it; each round shows an A/B question; everyone present votes; when all present members have voted the round reveals the split and advances; after the last round the result summary shows. State is persisted in the existing `GameSession` model and synced over the Phase-6a party gateway.

## Why 밸런스 게임 first

Zero free-text (no moderation surface), one-tap participation, produces instant conversation fodder (the reveal), and its state machine is trivially serializable — the right first plug-in for the pluggable game design.

## Scope

**In:** `GameService` (backend, question bank + state machine + `GameSession` persistence); game events on the EXISTING `PartyGateway` (it owns presence + authorization); shared `GameSnapshot` types; client-core party-socket game methods/handlers; a game card section in the mobile party room.

**Out:** additional game types (the interface is pluggable via `gameType`; only `"balance"` ships), server-side round timers (advance is all-voted or manual force-end), spectators, game history UI, per-round scoring/leaderboards.

## Key decisions (defaulted)

1. **Game handlers live on `PartyGateway`** — it already holds the presence map (needed for "all present members voted") and `authorize()`. Logic goes in a new injectable `GameService`; the gateway stays a thin transport.
2. **One active session per party** (start while active → `error {message:"already-active"}`).
3. **5 rounds** per game, questions drawn shuffled-without-replacement from a hardcoded Korean bank (≥10 entries) in the backend.
4. **Votes hidden until the round reveals**: the live snapshot exposes only `votedProfileIds`; when every present roster member has voted, the round's split (`aVoters`/`bVoters`) is published as `lastReveal` and the game advances (next question or `ended`).
5. **Anyone in the party can start; anyone can force-end** (`game:end`) — result keeps all completed reveals.
6. **Late joiners / reconnects sync** via `game:sync` → the server re-emits the current snapshot to that socket only.
7. **Persistence:** `GameSession.state` (Json) holds the full machine; `status` active→ended; `result` = reveals array on end. Server restart mid-game = game lost from memory but recoverable state stays in the DB (MVP: gateway reads back the active session on `game:sync`/`game:start` via the service, which always loads from DB — the DB **is** the state store; no in-memory game state).

## Gateway protocol (extends 6a's — same authorization rules)

**Client → server:**
- `game:start { partyId }` — participant-only; creates the session (409-style error if one is active); broadcasts the snapshot.
- `game:vote { partyId, choice: "a" | "b" }` — records/overwrites the caller's vote for the current round; if ALL present roster members (from the gateway's presence map) have voted → reveal + advance (or end after round 5); broadcasts the snapshot.
- `game:sync { partyId }` — emits the current snapshot (or `{ active: false }`) to the REQUESTING socket only.
- `game:end { partyId }` — force-ends the active session; broadcasts the final snapshot.

**Server → client:**
- `game:state { snapshot }` — after every state change (start/vote/reveal/advance/end) to the whole room; to one socket on sync.
- `error { message }` — `"forbidden"` (non-participant), `"already-active"`, `"no-active-game"`, `"invalid"` (bad choice).

## Shared types (`packages/shared/src/types/party.ts` — append)

```ts
export type GameChoice = "a" | "b";

export interface GameReveal {
  round: number;                 // 0-based, the revealed round
  question: { a: string; b: string };
  aVoters: string[];             // profileIds
  bVoters: string[];
}

export interface GameSnapshot {
  sessionId: string;
  gameType: "balance";
  status: "active" | "ended";
  round: number;                 // current round, 0-based (== totalRounds when ended)
  totalRounds: number;           // 5
  question: { a: string; b: string } | null;  // null when ended
  votedProfileIds: string[];     // current round, choices hidden
  reveals: GameReveal[];         // completed rounds, newest last
}

export interface GameStateEvent {
  partyId: string;
  snapshot: GameSnapshot | null; // null = no active/known game (sync response)
}
```

## Backend

### `GameService` (new, `apps/backend/src/party/game.service.ts`)

- `QUESTIONS: { a: string; b: string }[]` — hardcoded bank (≥10, Korean).
- `start(partyId): Promise<GameSnapshot>` — throws `ConflictException` if an active session exists; creates `GameSession { gameType: "balance", status: "active", state: { order, round: 0, votes: {} } }` where `order` = 5 shuffled distinct question indices.
- `vote(partyId, profileId, choice, presentMembers: string[]): Promise<GameSnapshot>` — `BadRequestException` on bad choice, `NotFoundException` if no active session; overwrites `state.votes[round][profileId]`; if every `presentMembers` id has voted → push the reveal, `round += 1`; when `round === totalRounds` → `status: "ended"`, `endedAt`, `result` = reveals; persists and returns the snapshot.
- `end(partyId): Promise<GameSnapshot>` — force-end (throws `NotFoundException` if none active).
- `current(partyId): Promise<GameSnapshot | null>` — the active session's snapshot, else the most recently ended one within this party… **no: strictly the ACTIVE session or null** (sync of a finished game returns null; the room UI keeps its last local snapshot for the summary).
- Snapshot never leaks unrevealed choices (current-round votes → ids only).
- State shape (Json): `{ order: number[], round: number, votes: Record<string, Record<string, GameChoice>>, reveals: GameReveal[] }` (votes keyed by round as string).

### `PartyGateway` (extend)

Four `@SubscribeMessage` handlers mirroring 6a's authorize-then-act pattern; `game:vote` passes the party's present roster (distinct profileIds from the presence map) into `GameService.vote`. All service exceptions → `error` emits (map Conflict→`already-active`, NotFound→`no-active-game`, BadRequest→`invalid`); never throw. `PartyModule` providers += `GameService`.

## client-core (`socket/party-socket.ts` — extend)

- Handlers += `onGameState?: (e: GameStateEvent) => void` (listens `game:state`).
- Handle += `startGame(partyId)`, `voteGame(partyId, choice)`, `syncGame(partyId)`, `endGame(partyId)` (emit the four events).
- Barrel: re-export `GameSnapshot`, `GameReveal`, `GameChoice`, `GameStateEvent` types from `@mingle/shared`.

## Mobile (`party/[id].tsx` — a game card between the 2D room and the chat)

- State: `game: GameSnapshot | null`. Socket handlers += `onGameState: (e) => setGame(e.snapshot ?? null)` — but keep an ended snapshot for the summary (sync's `null` must not clear a locally-known `ended` snapshot: only overwrite with non-null, or with null when no local snapshot exists).
- On join (same effect): `handle.syncGame(id)` after `joinParty`.
- UI (pure B&W):
  - No game → outlined button **"밸런스 게임 시작"** → `startGame`.
  - Active → round progress (`n/5`), the A/B question as two big tappable cards (mine = inverted ink fill), "n명 투표 완료" from `votedProfileIds.length`, my vote re-tappable until reveal; latest reveal (if any) as two B&W split bars with counts; a small **"게임 종료"** text button → `endGame`.
  - Ended → "게임 결과" summary listing each reveal (question + a/b counts) + **"다시 하기"** → `startGame`.
- Names for voters not needed in MVP (counts only) — avoids extra lookups.

## Error handling

All gateway game failures surface as the existing `error` events (the screen shows its `socketDown`-style non-blocking notice only for transport errors; game logic errors like `already-active` are benign — the follow-up `game:state`/sync converges the UI).

## Testing

- **Backend jest:** `GameService` (start/conflict, vote overwrite, hidden choices, all-present advance + reveal correctness, end-of-game result, force-end, bad choice, no-active) + gateway handler tests (authorize, event names, roster passed to vote, error mapping). 
- **client-core vitest:** new emit names/payloads + `onGameState` wiring (extend the party-realtime test).
- **Mobile:** tsc CLEAN; existing vitest untouched.
- **Live E2E (controller):** extend the 2-socket script — A starts, A+B vote round-by-round through 5 rounds (assert reveals + advance), non-participant C `game:start` forbidden, final `ended` snapshot with 5 reveals.

## Out of scope / backlog

- More game types (quiz, drawing) — plug via `gameType` + a service registry when the second game lands.
- Round timers / AFK auto-advance (roster-based advance suffices while presence is accurate).
- Game deep-link notifications; game history screens.
