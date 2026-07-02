# Phase 4 Design — Proposal → Match → Messenger

**Status:** CONFIRMED (brainstorming approved 2026-07-02)
**Branch:** `megahuni` (v2 go-forward; builds on Phase 0–3)
**Depends on:** Phase 1 data model (Proposal/Match/DirectMessageRoom/DirectMessage/Block/Notification models all exist), Phase 3 matchmaking (Party/PartyParticipant, the sweep worker).

## 1. Goal

Let two people who met in a party take the relationship private: **A proposes to B → B accepts → a Match forms → a 1:1 realtime messenger opens.** Wire the existing (unenforced) **Block** into proposals, DMs, and matchmaking. Notifications are in-app rows only.

## 2. Scope

**In scope**
- `proposal` module: send / list-received / list-sent / accept / decline (REST).
- `match` module: create a Match + DirectMessageRoom from an accepted proposal (normalized, idempotent); list my matches.
- `messenger` module: room list, paginated history, send message, room-level mark-read (REST).
- `MessengerGateway`: the project's **first Socket.IO gateway** — JWT-authenticated realtime delivery of new messages, room-level read receipts, and typing indicators. Thin: no persistence or business logic.
- **Block enforcement** across three surfaces: proposal send, DM send/room access, and the Phase-3 matchmaking sweep (exclude blocked pairs from the same party).
- **In-app notifications** (existing `NotificationService`) for: proposal received, match made, new DM message.
- `@mingle/client-core`: proposal / match / messenger / block APIs + a platform-injected socket wrapper. `apps/mobile`: send-proposal entry, received-proposals list, matches/chat list, chat room (realtime), block/report entry points.

**Non-goals (deferred, surfaced)**
- **Expo push notifications** → Phase 5. Needs a new `PushToken`/device model (a migration) + `expo-server-sdk` + device-token plumbing. Phase 4 emits in-app `Notification` rows + realtime socket events only.
- **Restaurant reservation / DatePlan** → Phase 5 (DatePlan already links `matchId`).
- **Advanced content moderation** (AI/toxicity) → Phase 5 safety/launch. Phase 4 ships message length caps + report/block entry points only.
- **Multi-instance realtime**: the gateway (like the sweep) is safe only at `instances: 1` until `@socket.io/redis-adapter` is added. Documented, not built.
- **No database migration** — every model this phase needs already exists in `schema.prisma`.

## 3. Data model (existing — no migration)

Reused as-is from Phase 1:

- **Proposal** — `partyId`, `fromProfileId`, `toProfileId`, `status` (`pending|accepted|declined`), `createdAt`, `respondedAt?`. `@@unique([partyId, fromProfileId, toProfileId])`, `@@index([toProfileId, status])`.
- **Match** — `partyId?`, `proposalId? @unique`, `profileId1`, `profileId2`, `createdAt`. **`@@unique([profileId1, profileId2])` is order-sensitive** → creation MUST normalize ordering (see §8).
- **DirectMessageRoom** — `matchId @unique` (1:1 with a Match), `createdAt`.
- **DirectMessage** — `roomId`, `senderProfileId`, `content`, `readAt?`, `createdAt`. `@@index([roomId, createdAt])`.
- **Block** — `blockerProfileId`, `blockedProfileId`, `createdAt`. `@@unique([blockerProfileId, blockedProfileId])`. (`safety.service` already has `createBlock`/`listBlocks`; enforcement is new.)
- **Notification** — `userId`, `type` (String column), `title`, `message`, `data?`, `read`. CRUD exists.

## 4. Modules

### 4.1 `proposal` (REST, `@UseGuards(JwtAuthGuard)`, caller = `user.userId` → profile)

| Method | Route | Behavior |
|---|---|---|
| `POST` | `/proposals` | Body `{ partyId, toProfileId }`. Create a `pending` proposal from the caller's profile. Guards below. |
| `GET` | `/proposals/received` | Caller's `pending` received proposals (with party + sender public projection). |
| `GET` | `/proposals/sent` | Caller's sent proposals (any status). |
| `POST` | `/proposals/:id/accept` | Recipient-only. → Match + Room (see §4.2). Idempotent. |
| `POST` | `/proposals/:id/decline` | Recipient-only. `status=declined`, `respondedAt=now`. **No notification to the sender.** |

**Send guards (all → 4xx, checked before persist):**
1. `toProfileId != fromProfileId` (no self-proposal) → 400.
2. Both are (or were) participants of `partyId`, and that party is `active` OR ended within **`PROPOSAL_WINDOW_HOURS`** (default 24) → else 403/404. (Party has no `endedAt`? treat `status="ended"` + a `updatedAt`/party timestamp as end; see §8 note.)
3. **Not blocked either direction** between the two profiles → 403 (§6).
4. Caller's proposal count in this party (`pending+accepted+declined`) `< PROPOSAL_MAX_PER_PARTY` (default 3) → else 409.
5. No existing proposal for `(partyId, from, to)` (the `@@unique`) → P2002 → 409 "이미 프로포즈함".
6. The pair is not already matched → if a Match exists for the normalized pair, 409 "이미 매칭됨".

### 4.2 `match` (mostly internal service)

- `createFromProposal(proposal)` — called inside the accept transaction:
  1. **Normalize**: `[profileId1, profileId2] = [from, to].sort()` (lexicographic) so `profileId1 < profileId2`.
  2. **Create-or-get** the Match on `@@unique([profileId1, profileId2])` — on `P2002` (a concurrent/ reverse-direction accept already made it), fetch and reuse the existing Match (do NOT create a duplicate). Set `proposalId`/`partyId` on first creation.
  3. **Create-or-get** the `DirectMessageRoom` on `matchId @unique` (idempotent).
- `listMyMatches(profileId)` — matches where the caller is `profile1` or `profile2`, with the peer's public projection + room id + last message + unread count.

### 4.3 `messenger` (REST + gateway hook)

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/messenger/rooms` | Caller's rooms (peer projection, last message, unread count, `lastReadAt` per side). Excludes rooms with an active block (§6). |
| `GET` | `/messenger/rooms/:id/messages` | Paginated history (`?before=<cursor>&limit`), membership-guarded. |
| `POST` | `/messenger/rooms/:id/messages` | Body `{ content }` (1–`MESSAGE_MAX_LEN` = 2000). Persist, then `gateway.emitNewMessage(roomId, msg)`. Blocked → 403. |
| `POST` | `/messenger/rooms/:id/read` | Room-level: `updateMany` sets `readAt=now` on the caller's unread messages in the room; returns `lastReadAt`; then `gateway.emitRead(roomId, { readerProfileId, lastReadAt })`. |

Membership: the caller's profile must be `profile1`/`profile2` of the room's match → else 403 (no IDOR; room id is not a capability).

### 4.4 `MessengerGateway` (Socket.IO, first gateway)

- **Handshake auth**: read JWT from `handshake.auth.token`, verify with the existing `JwtService`, resolve `userId → profileId`; reject on failure (`disconnect`).
- **Client→server**: `room:join {roomId}` / `room:leave {roomId}` (membership-authorized via messenger service → `socket.join(roomId)`); `typing:start {roomId}` / `typing:stop {roomId}` (membership-authorized; **ephemeral, not persisted**).
- **Server→client**: `message:new {roomId, message}`; `message:read {roomId, readerProfileId, lastReadAt}` (room-level, one per read action); `typing {roomId, profileId, isTyping}` (broadcast to the room minus the sender).
- Typing is the only client-originated write, and it persists nothing / touches no business state; the gateway still authorizes room membership. Client auto-sends `typing:stop` after ~3s idle, on blur, and on disconnect.
- **Single-instance only** (`instances: 1`) until a redis adapter is added — same constraint as the sweep.

## 5. Realtime + read model

- **Read receipts are room-level.** There is no per-message tick UI; when a participant opens a room, the client calls `POST …/read`, which marks all their unread messages read and emits one `message:read` with `lastReadAt`. The peer's client renders "읽음" for every message with `createdAt ≤ lastReadAt`. The per-message `readAt` column is the storage; the surfaced signal is per-room.
- **Delivery**: all writes go through REST (persist + guards + block checks in tested services); the gateway only broadcasts what REST persisted (`message:new`, `message:read`) plus ephemeral `typing`. If the socket is down, the mobile client falls back to REST refetch of history/rooms.

## 6. Block enforcement (shared rule)

"A block exists between X and Y" ⇔ `Block(blocker=X, blocked=Y) OR Block(blocker=Y, blocked=X)`. A single `safety.service` helper `isBlockedBetween(a, b): Promise<boolean>` (one `findFirst` with an `OR`). Enforced at:

- **Proposal send** (§4.1 guard 3) → 403.
- **DM send + room list/access** (§4.3) → 403 on send; the blocker's room list hides rooms whose peer is blocked. The Match and room rows are **retained** (not deleted); access is refused.
- **Matchmaking sweep** (Phase 3 `matchmaking.sweep.ts`, formation pass): when selecting members for an anchor, **skip a candidate if a block exists** between that candidate and the anchor or any already-selected member. Implemented by loading the blocks touching the working set once per sweep and filtering in-memory (no per-pair query storm).
- **Block creation** (`safety`): already persists; enforcement above makes it effective immediately. Unblock = delete the `Block` row (existing `@@unique` makes re-block idempotent).

## 7. Notifications (in-app rows; push deferred)

Create `Notification` rows via the existing `NotificationService.create` (outside any transaction):
- **proposal received** → `toProfileId`'s user, `type: "proposal_received"`.
- **match made** → both users, `type: "match_made"`.
- **new DM message** → recipient's user, `type: "message_received"` (coalescing/rate-limiting is a follow-up).
- **decline** → none (protects the recipient).

Extend the `CreateNotificationDto.type` union with `proposal_received | match_made | message_received` (the DB column is a free `String`; no migration). Realtime for proposals/matches relies on the mobile app's existing unread-count/list polling of `/notifications`; live DM uses the gateway room channel. A global per-user socket channel is a possible follow-up, not in this phase.

## 8. Invariants, concurrency, errors

- **Match ordering normalization** (carry-forward invariant): always persist `profileId1 < profileId2`. Combined with `@@unique([profileId1, profileId2])`, concurrent accepts of `A→B` and `B→A` cannot create two Matches or two rooms.
- **Accept = a Serializable `$transaction`** (count-then-create Match, per CLAUDE.md): re-read the proposal and **status-guard** its transition (`updateMany where status="pending"` → 0 rows ⇒ already handled ⇒ 409/idempotent); create-or-get Match (absorb `P2002`); create-or-get Room; on `P2034` retry (bounded, like enqueue). **Notifications are sent outside the transaction.**
- **Party-end timestamp**: `Party` has `endedAt DateTime?` (and `updatedAt`). The 24h window is: eligible if `party.status = "active"` **OR** (`party.status = "ended"` AND `party.endedAt >= now − PROPOSAL_WINDOW_HOURS`). No schema change. NB: a party-end/lifecycle flow is not yet wired (parties currently remain `active`), so in practice the `active` branch governs today; the `endedAt` branch is correct and ready for when party-end lands.
- Length: `content` 1–2000; over → 400. Basic per-sender rate limiting is a noted follow-up.
- All routes `JwtAuthGuard` + caller-bound (no room/proposal id acts as a capability without an ownership/membership check).

## 9. Client (`@mingle/client-core` + `apps/mobile`)

- **client-core** (Vitest): `proposals` API (send/received/sent/accept/decline), `matches` API (list, room, history, send, read), `blocks` API (create/list/delete), and a **platform-injected socket wrapper** (the socket.io-client instance + auth token are injected like token storage/env, keeping the package platform-agnostic). Shared types in `@mingle/shared` (Proposal/Match/Room/Message DTOs, socket event payloads).
- **mobile** (Expo Router, doodle B&W): a "프로포즈 보내기" entry from the party/participant view; a received-proposals screen (accept/decline); a matches/chat list; a chat room screen (history + realtime `message:new`/`message:read`/`typing`, send, room-level read, block/report entry). Screens live under `app/(app)/` behind the profile gate.

## 10. Testing

- **jest (backend)**: proposal guards (self / non-participant / expired-window / blocked / over-cap / duplicate / already-matched); match normalization + idempotency + `P2002`/`P2034` concurrency; messenger membership + room-level mark-read; `isBlockedBetween` bidirectionality; sweep block-exclusion; gateway handshake-auth + room-join authorization + `emit` on persist + typing broadcast (member-authorized, non-persisted).
- **vitest (client-core)**: each API's method/URL/shape; the injected socket wrapper's connect/join/emit/listen.
- **E2E (live)**: propose → accept → Match (single, normalized) → open room → realtime `message:new` → room-level read → typing; block prevents proposal + DM + co-party formation; decline is silent to the sender.

## 11. Environment

Backend `.env` (all optional → validated defaults): `PROPOSAL_WINDOW_HOURS` (24), `PROPOSAL_MAX_PER_PARTY` (3), `MESSAGE_MAX_LEN` (2000). Gateway runs on the existing HTTP server; `instances: 1` until a redis adapter is added.

## 12. Task decomposition (for the implementation plan)

Roughly 7–8 TDD tasks: (1) `@mingle/shared` Phase-4 DTOs + socket event types + `isBlockedBetween` contract; (2) block enforcement helper + `safety` wiring + sweep block-exclusion; (3) `proposal` service + REST (guards); (4) `match` service (normalized, idempotent, Serializable accept); (5) `messenger` service + REST (history/send/room-read) + notifications; (6) `MessengerGateway` (auth/join/emit/typing); (7) `client-core` APIs + socket wrapper; (8) mobile screens.
