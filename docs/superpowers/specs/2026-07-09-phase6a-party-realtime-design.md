# Phase 6a: Party Realtime Gateway + Presence + Party Chat — Design

**Date:** 2026-07-09
**Status:** Approved design (pre-plan)
**Branch:** `megahuni`

## Goal

Give the party room a live heartbeat: a Socket.IO **party gateway** that tracks who is present, carries party-wide chat (persisted), and provides the position-broadcast transport that Phase 6b's 2D space will ride on. This turns the party from a static REST participant list into a real shared room.

## Why now / vision

`DEVELOPMENT_PLAN.md §3.4` (2D top-down party space), `§3.5` (icebreaker minigames), and `§5.3.3` (realtime party/chat/game gateway) describe the core "가벼운 만남" experience — users hang out, talk, and play in a live party before proposing. None of it exists yet: the party is a REST snapshot. Phase 6a builds the realtime foundation the rest of Phase 6 depends on.

## Phase 6 decomposition (this spec = 6a only)

The user chose the **full 2D movement space (Skia + position sync)**. That is large, so Phase 6 is split into three sequential, independently-shippable sub-phases:

- **6a (this spec)** — party realtime gateway (backend) + presence + party chat (persisted) + the position-broadcast transport. Delivers live party chat + presence in the room.
- **6b** — 2D top-down Skia party space (mobile): avatar rendering, local movement controls, position send/receive (throttled) over 6a's `party:move`/`party:moved`.
- **6c** — icebreaker minigames (1–2, pluggable) using the existing `GameSession` model + gateway game-state events.

Dependency order forces 6a first.

## Background — existing state (verified)

- **Realtime pattern to mirror:** `MessengerGateway` (`apps/backend/src/messenger/messenger.gateway.ts`, 73 lines) — `@WebSocketGateway({ cors: { origin: true } })`, `handleConnection` reads `client.handshake.auth.token` → `jwt.verify` → `client.data.userId`; `@SubscribeMessage("room:join")` authorizes via `assertMember` then `client.join(roomId)`; broadcasts with `client.to(room).emit(...)` / `this.server.to(room).emit(...)`. Wired in `MessengerModule` (imports `AuthModule` for `JwtService`).
- **Client socket pattern to mirror:** `packages/client-core/src/socket/messenger-socket.ts` — `connectMessengerSocket({ ioFactory, baseUrl, token, handlers }): MessengerSocketHandle` with an injected `ioFactory` (`socket.io-client`'s `io`), a `joinedRooms` set for auto-rejoin on reconnect, and handlers `onMessage/onRead/onTyping/onError/onReconnect`.
- **Party is REST-only:** `party.service` has `findAll`/`findOne` (public projections) — **no membership assertion, no messages**. `party.controller` has no messages route. Mobile `party/[id].tsx` polls `getMatchmakingStatus()` and renders a static participant list + propose buttons.
- **Models already exist (Phase-1 baseline — NO migration needed):**
  - `PartyMessage { id, partyId, profileId, content, createdAt }` (`@@index([partyId, createdAt])`).
  - `PartyParticipant { partyId, profileId, joinedAt }` with composite PK `@@id([partyId, profileId])`.
  - `GameSession { id, partyId, gameType, state Json, status, result Json?, startedAt, endedAt }` — reserved for 6c.
- **Auth in the gateway:** the JWT `sub` is the userId; a participant's `profileId` is resolved via `prisma.profile.findUnique({ where: { userId } })`.

## Scope

**In (6a):** the `PartyGateway`; `party.service` participant-assert + party-message read/write; a `GET /party/:id/messages` history endpoint; shared party realtime types; a client-core `connectPartySocket` wrapper + `getPartyMessages`; a minimal party **chat + presence** UI in the existing `party/[id].tsx`.

**Out (later / not this phase):** the 2D Skia space + avatar movement rendering (6b), minigames (6c), the CORS `origin: true` → allowlist hardening (launch phase), position persistence, and per-message in-party block filtering (see Backlog).

## Global Constraints

- Realtime mirrors `MessengerGateway`: Socket.IO default namespace, JWT handshake auth, room = `partyId`, best-effort broadcast wrapped so a socket failure never throws into a request path.
- REST history is the source of truth for chat; socket broadcast is the live layer (same contract as the messenger).
- Authorization: every party socket action and the messages endpoint require the caller to be a `PartyParticipant` of that party (else `forbidden` / 403).
- **Pure black & white** for any mobile UI (ink `#17150F`, paper `#FFFFFF`, grays `#45413A`/`#8A857C`/`#D9D5CC`, fills `#F1EFE9`/`#E7E4DC`; zero chroma).
- ESM `.js` barrels; TS strict; Prettier (double quotes, `trailingComma: all`, `printWidth: 100`, semicolons). Never stage `.env`. Do NOT push without explicit confirmation.
- No new backend dependency (`socket.io` + `@nestjs/websockets` already present from the messenger). Mobile already has `socket.io-client` (used by the messenger screen).

## Design

### 1. Gateway event protocol (the contract)

**Connection:** client connects with `auth: { token }`; `handleConnection` verifies the JWT and sets `client.data.userId` (disconnect on failure), identical to `MessengerGateway`.

**Client → server** (`@SubscribeMessage`):
- `party:join { partyId }` — authorize via `assertParticipant`; on success `client.join(partyId)`, register presence, and emit the current roster; on failure `emit("error", { message: "forbidden" })`.
- `party:leave { partyId }` — `client.leave(partyId)`, deregister presence, re-broadcast roster.
- `party:chat { partyId, content }` — authorize; persist a `PartyMessage`; broadcast `party:message` to the room (including sender).
- `party:move { partyId, x, y }` — authorize (cheap, cached membership acceptable); broadcast `party:moved { profileId, x, y }` to **others** in the room. Ephemeral; never persisted. (Consumed by 6b; defined here so 6b is mobile-only.)

**Server → client:**
- `party:presence { partyId, members: string[] }` — the distinct `profileId`s currently connected to the party; emitted to the whole room on any join/leave/disconnect.
- `party:message { …PartyMessageView }` — a newly persisted party message.
- `party:moved { profileId, x, y }` — another member's latest position.
- `error { message }` — authorization or validation failure.

**Presence tracking:** the gateway holds an in-memory map `partyId → Map<socketId, profileId>`; roster = distinct profileIds. `handleDisconnect` removes the socket from every party it was in and re-broadcasts affected rosters. Presence and positions are ephemeral (lost on disconnect) by design.

### 2. Backend

- **`party.service`** (add):
  - `assertParticipant(userId, partyId): Promise<string | null>` — resolve the caller's `profileId` via `profile.findUnique({ where: { userId } })`, then `partyParticipant.findUnique({ where: { partyId_profileId: { partyId, profileId } } })`; return `profileId` if a participant, else `null`.
  - `addPartyMessage(profileId, partyId, content): Promise<PartyMessageView>` — validate non-empty/`content` length (≤ 2000, matching DM bounds), create the `PartyMessage`, return the view.
  - `getPartyMessages(partyId, limit = 50): Promise<PartyMessageView[]>` — most-recent-first (or ascending for render — pick ascending to match a chat log), bounded.
- **`party.controller`** (add): `GET /party/:id/messages` — `@UseGuards(JwtAuthGuard)`, `@CurrentUser()`; call `assertParticipant`, 403 if not a member; return `getPartyMessages`.
- **`PartyGateway`** (new): mirrors `MessengerGateway`; injects `JwtService` + `PartyService`; implements the protocol above.
- **`PartyModule`** (modify): import `AuthModule` (for `JwtService`); add `PartyGateway` to providers. No emitter provider is needed — party chat originates on the socket, not via a REST→socket seam.

### 3. shared (`packages/shared/src/types/social.ts` or a new `party.ts`)

```ts
export interface PartyMessageView { id: string; partyId: string; profileId: string; content: string; createdAt: string; }
export interface PartyPresence { partyId: string; members: string[]; }
export interface PartyMove { profileId: string; x: number; y: number; }
```
(Barrel-export all three.)

### 4. client-core

- **`socket/party-socket.ts`** — `connectPartySocket({ ioFactory, baseUrl, token, handlers }): PartySocketHandle`, mirroring `connectMessengerSocket`:
  - `PartySocketHandlers { onMessage?(PartyMessageView); onPresence?(PartyPresence); onMoved?(PartyMove); onError?(unknown); onReconnect?() }`.
  - `PartySocketHandle { joinParty(partyId); leaveParty(partyId); sendChat(partyId, content); move(partyId, x, y); disconnect() }`.
  - Track joined parties for auto-rejoin on reconnect (skip the first `connect`), exactly as the messenger wrapper does.
- **`api/party.ts`** — add `getPartyMessages(partyId): Promise<PartyMessageView[]>` → `apiFetch("/party/{partyId}/messages")`.
- Barrel-export `connectPartySocket`, its types, and `getPartyMessages`.

### 5. mobile (`apps/mobile/app/(app)/party/[id].tsx`)

Add a minimal, pure-B&W **party chat + presence** section beneath the existing participant list:
- On focus: `getPartyMessages(id)` for history, then `connectPartySocket(...)` (using the app's injected `io` from `socket.io-client`, the same wiring as the chat screen's `openMessengerSocket`) → `joinParty(id)`.
- Render an inverted chat list (newest at bottom) fed by history + `onMessage`; a presence line ("N명 접속 중" from `onPresence`); a `TextInput` + send that calls `sendChat(id, content)` (optimistic add, dedup by message id).
- Clean up (`leaveParty` + `disconnect`) on blur/unmount.
- The 2D space and movement are **not** added here — 6b replaces/augments this screen with the Skia canvas, reusing the same socket handle (`move`/`onMoved`).

## Data flow

- **Chat:** client `sendChat` → gateway persists `PartyMessage` → `server.to(partyId).emit("party:message")` → all members (incl. sender, deduped). History via `GET /party/:id/messages`.
- **Presence:** `party:join`/`leave`/`disconnect` mutate the in-memory roster → `party:presence` to the room.
- **Position (transport only in 6a):** `party:move` → `party:moved` to others; ephemeral.

## Error handling

Unauthorized socket actions → `error { message: "forbidden" }` (no throw). The messages endpoint → 403 for non-participants, 404 for a missing party. Socket broadcasts are best-effort (a failed emit never breaks persistence). The mobile screen shows a non-blocking banner if the socket cannot connect and still renders REST history.

## Testing

- **Backend (jest):** `party.service` — `assertParticipant` (member / non-member / missing profile), `addPartyMessage` (persists + bounds), `getPartyMessages` (ordering + limit); `PartyGateway` handler unit tests mirroring `messenger.gateway.spec` (join authorizes, chat persists+broadcasts, move broadcasts to others, disconnect updates presence). Boot maps the gateway.
- **client-core (vitest):** `getPartyMessages` (path/method) and `connectPartySocket` (emits the right events on join/leave/chat/move; wires handlers) using an injected mock `ioFactory`, mirroring the messenger-socket tests.
- **mobile:** `tsc --noEmit` CLEAN (screen convention) + existing Vitest suite unaffected.

## Out of scope / backlog

- 2D Skia space + avatar movement rendering (6b); minigames + `GameSession` wiring (6c).
- **In-party runtime block filtering:** party formation already excludes blocked pairs (Phase-3 sweep), so co-presence of a blocked pair requires blocking *during* a live party — an edge case. Per-message/presence block filtering in the party gateway is deferred and documented; revisit if it proves user-facing.
- Gateway CORS `origin: true` → allowlist (launch-readiness phase; shared with the messenger gateway).
- Position/roster persistence (intentionally ephemeral).
- Party-message pagination beyond the initial `limit` (load-older), and read receipts (not needed for a group room).
