# Phase 4 — Proposal → Match → Messenger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let two people who met in a party go private — A proposes → B accepts → a Match forms → a realtime 1:1 messenger opens — and make the existing Block model actually enforced.

**Architecture:** Fill the three empty skeleton modules (`proposal`/`match`/`messenger`) as REST services under `JwtAuthGuard`, add the project's first Socket.IO gateway as a thin realtime delivery layer (messages/read/typing), and wire a shared block check into proposals, DMs, and the Phase-3 matchmaking sweep. No database migration — every model exists.

**Tech Stack:** NestJS 10 + Prisma 6 (Postgres :5433), `@nestjs/websockets` + `socket.io`, `@nestjs/jwt`, `@mingle/shared` (ESM+CJS dual-package), `@mingle/client-core` (Vitest), Expo Router mobile, `socket.io-client`.

## Global Constraints

- **No DB migration.** Reuse `Proposal`, `Match`, `DirectMessageRoom`, `DirectMessage`, `Block`, `Notification` as they exist in `apps/backend/prisma/schema.prisma`. `Notification.type` is a free `String` column.
- **Match ordering MUST be normalized**: always store `profileId1 < profileId2` (lexicographic). `Match` has `@@unique([profileId1, profileId2])` (order-sensitive) → without normalization a pair yields two Matches + two rooms.
- **Accept = Serializable `$transaction` + bounded P2034 retry** (CLAUDE.md count-then-create convention); status-guard the proposal transition; absorb `P2002` as idempotent; **send notifications OUTSIDE the transaction**.
- **Block is bidirectional in enforcement**: a block exists between X and Y iff `Block(X→Y) OR Block(Y→X)`. Enforced at proposal send, DM send/room access, and matchmaking party formation. Existing Match/room rows are retained (hidden), never deleted.
- **All routes under `JwtAuthGuard`, caller-bound** (profile derived from `user.userId`; a room/proposal id is never a capability without a membership/ownership check).
- **Realtime is single-instance** (`instances: 1`) until `@socket.io/redis-adapter` is added — same as the sweep. The gateway is a thin delivery layer; ALL writes/guards/persistence stay in REST services.
- **Env** (backend `.env`, all optional → validated defaults): `PROPOSAL_WINDOW_HOURS` (24), `PROPOSAL_MAX_PER_PARTY` (3), `MESSAGE_MAX_LEN` (2000).
- **Import paths (verified):** `JwtAuthGuard` from `../common/guards/jwt-auth.guard`; `CurrentUser` + `JwtPayload` from `../common/decorators/current-user.decorator`; `PrismaService` from `../prisma/prisma.service`; `PrismaModule` from `../prisma/prisma.module`.
- **Prettier:** double quotes, `trailingComma: all`, `printWidth: 100`, semicolons. **ANSI-safe TS check:** `... 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error"`.
- **Deferred (do NOT build):** Expo push (needs a PushToken model = migration), DatePlan/reservation, AI content moderation, multi-instance realtime.

---

## File Structure

**`@mingle/shared`** (build first):
- Modify `packages/shared/src/types/social.ts` — add `DirectMessageRoom`, `DirectMessage`, `MatchSummary`, `ProposalView`, socket event payloads.
- Create `packages/shared/src/social/pair.ts` — `normalizeMatchPair(a, b)` + `blockPairKey(a, b)` pure helpers (tested).
- Modify `packages/shared/src/index.ts` — barrel exports.

**Backend** (`apps/backend/src/`):
- `safety/safety.service.ts` (modify) — add `isBlockedBetween`, `removeBlock`, `blocksForProfiles`.
- `safety/safety.controller.ts` (modify) — add block create/list/delete routes.
- `matchmaking/matchmaking.sweep.ts` (modify) — exclude blocked pairs in formation.
- `proposal/proposal.service.ts` + `proposal.controller.ts` + `proposal.module.ts` — send/received/sent/decline (+ accept route delegating to match).
- `match/match.service.ts` + `match.module.ts` — `createFromProposal`, `acceptProposal`, `listMyMatches`.
- `messenger/messenger.service.ts` + `messenger.controller.ts` + `messenger.module.ts` — rooms/history/send/read; depends on an injected emitter token.
- `messenger/messenger.gateway.ts` — Socket.IO gateway implementing the emitter.
- `auth/auth.module.ts` (modify) — export `JwtModule` so the gateway can inject `JwtService`.

**`@mingle/client-core`** (`packages/client-core/src/`):
- `api/proposals.ts`, `api/matches.ts`, `api/messenger.ts`, `api/blocks.ts` — REST wrappers.
- `socket/messenger-socket.ts` — injected-`io` socket wrapper.
- `index.ts` (modify) — barrel.

**Mobile** (`apps/mobile/`):
- `app/(app)/proposals.tsx` — received proposals.
- `app/(app)/chats.tsx` — match/chat list.
- `app/(app)/chat/[roomId].tsx` — realtime chat room.
- `app/(app)/party/[id].tsx` (modify) — add "프로포즈 보내기".
- `src/lib/messenger-socket.ts` — wires `socket.io-client` `io` into the client-core wrapper.
- `package.json` (modify) — add `socket.io-client`.

---

## Task 1: `@mingle/shared` Phase-4 DTOs + pair helpers

**Files:**
- Create: `packages/shared/src/social/pair.ts`
- Create: `packages/shared/src/social/pair.test.ts`
- Modify: `packages/shared/src/types/social.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `normalizeMatchPair(a: string, b: string): [string, string]` (sorted asc); `blockPairKey(a: string, b: string): string`; types `DirectMessageRoom`, `DirectMessage`, `MatchSummary`, `ProposalView`, `NewMessageEvent`, `ReadEvent`, `TypingEvent`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/social/pair.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { normalizeMatchPair, blockPairKey } from "./pair.js";

describe("normalizeMatchPair", () => {
  it("returns the two ids sorted ascending regardless of argument order", () => {
    expect(normalizeMatchPair("b", "a")).toEqual(["a", "b"]);
    expect(normalizeMatchPair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("blockPairKey", () => {
  it("is order-independent", () => {
    expect(blockPairKey("x", "y")).toBe(blockPairKey("y", "x"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/shared exec vitest run src/social/pair.test.ts`
Expected: FAIL — cannot resolve `./pair.js`.

- [ ] **Step 3: Write the implementation** — `packages/shared/src/social/pair.ts`

```ts
/** Normalized (profileId1, profileId2) ordering for the Match @@unique — always ascending. */
export function normalizeMatchPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Order-independent key for a pair of profile ids (used for block lookups). */
export function blockPairKey(a: string, b: string): string {
  const [x, y] = normalizeMatchPair(a, b);
  return `${x}:${y}`;
}
```

- [ ] **Step 4: Add the DTO + event types** — append to `packages/shared/src/types/social.ts`

```ts
export interface DirectMessageRoom {
  id: string;
  matchId: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  roomId: string;
  senderProfileId: string;
  content: string;
  readAt?: string | null;
  createdAt: string;
}

/** A profile as exposed to a peer (no riskScore / raw preferenceSignals). */
export interface PeerProfile {
  profileId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  photoUrl?: string;
  preferenceSummary?: string;
}

/** One row in the match/chat list. */
export interface MatchSummary {
  matchId: string;
  roomId: string;
  peer: PeerProfile;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

/** A received/sent proposal with the counterpart projection. */
export interface ProposalView {
  id: string;
  partyId: string;
  status: ProposalStatus;
  createdAt: string;
  peer: PeerProfile;
}

export interface NewMessageEvent {
  roomId: string;
  message: DirectMessage;
}
export interface ReadEvent {
  roomId: string;
  readerProfileId: string;
  lastReadAt: string;
}
export interface TypingEvent {
  roomId: string;
  profileId: string;
  isTyping: boolean;
}
```

- [ ] **Step 5: Barrel exports** — in `packages/shared/src/index.ts`, extend the social export block and add the pair helpers:

```ts
export type {
  ProposalStatus,
  Proposal,
  Match,
  Block,
  DirectMessageRoom,
  DirectMessage,
  PeerProfile,
  MatchSummary,
  ProposalView,
  NewMessageEvent,
  ReadEvent,
  TypingEvent,
} from "./types/social.js";
export { normalizeMatchPair, blockPairKey } from "./social/pair.js";
```

- [ ] **Step 6: Build + test to verify pass**

Run: `pnpm --filter @mingle/shared build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -iE "error" || echo CLEAN` then `pnpm --filter @mingle/shared exec vitest run`
Expected: CLEAN; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/social packages/shared/src/types/social.ts packages/shared/src/index.ts
git commit -m "feat(shared): Phase 4 DTOs (DM/room/summary/events) + match-pair + block-pair helpers"
```

---

## Task 2: Block enforcement — `isBlockedBetween` + safety routes + sweep exclusion

**Files:**
- Modify: `apps/backend/src/safety/safety.service.ts`
- Modify: `apps/backend/src/safety/safety.controller.ts`
- Modify: `apps/backend/src/safety/safety.service.spec.ts`
- Modify: `apps/backend/src/matchmaking/matchmaking.sweep.ts`
- Modify: `apps/backend/src/matchmaking/matchmaking.sweep.spec.ts`

**Interfaces:**
- Consumes: `blockPairKey` from `@mingle/shared`.
- Produces: `SafetyService.isBlockedBetween(a: string, b: string): Promise<boolean>`; `SafetyService.blocksForProfiles(ids: string[]): Promise<Set<string>>` (set of `blockPairKey`s); `SafetyService.removeBlock(blockerProfileId, blockedProfileId): Promise<void>`.

- [ ] **Step 1: Write the failing test** — append to `apps/backend/src/safety/safety.service.spec.ts`

```ts
import { blockPairKey } from "@mingle/shared";

describe("SafetyService — block queries", () => {
  it("isBlockedBetween is true when a block exists in EITHER direction", async () => {
    const prisma = { block: { findFirst: jest.fn().mockResolvedValue({ id: "b1" }) } } as any;
    const service = new SafetyService(prisma);
    await expect(service.isBlockedBetween("a", "b")).resolves.toBe(true);
    expect(prisma.block.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerProfileId: "a", blockedProfileId: "b" },
          { blockerProfileId: "b", blockedProfileId: "a" },
        ],
      },
    });
  });

  it("isBlockedBetween is false when no block row exists", async () => {
    const prisma = { block: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new SafetyService(prisma);
    await expect(service.isBlockedBetween("a", "b")).resolves.toBe(false);
  });

  it("blocksForProfiles returns order-independent pair keys", async () => {
    const prisma = {
      block: {
        findMany: jest.fn().mockResolvedValue([{ blockerProfileId: "b", blockedProfileId: "a" }]),
      },
    } as any;
    const service = new SafetyService(prisma);
    const set = await service.blocksForProfiles(["a", "b", "c"]);
    expect(set.has(blockPairKey("a", "b"))).toBe(true);
    expect(set.has(blockPairKey("a", "c"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/backend exec jest safety.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | tail -15`
Expected: FAIL — `isBlockedBetween`/`blocksForProfiles` not a function.

- [ ] **Step 3: Implement in `safety.service.ts`** — add the import and three methods (place next to `createBlock`):

```ts
import { blockPairKey } from "@mingle/shared";
```

```ts
  isBlockedBetween(a: string, b: string): Promise<boolean> {
    return this.prisma.block
      .findFirst({
        where: {
          OR: [
            { blockerProfileId: a, blockedProfileId: b },
            { blockerProfileId: b, blockedProfileId: a },
          ],
        },
      })
      .then((row) => row !== null);
  }

  /** All block pairs (as order-independent keys) among the given profile ids. */
  async blocksForProfiles(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.block.findMany({
      where: { blockerProfileId: { in: ids }, blockedProfileId: { in: ids } },
      select: { blockerProfileId: true, blockedProfileId: true },
    });
    return new Set(rows.map((r) => blockPairKey(r.blockerProfileId, r.blockedProfileId)));
  }

  async removeBlock(blockerProfileId: string, blockedProfileId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerProfileId, blockedProfileId } });
  }
```

- [ ] **Step 4: Add block routes to `safety.controller.ts`** — the controller already uses `JwtAuthGuard` + a profile lookup for the caller (follow the existing report route's pattern for resolving `profileId` from `@CurrentUser`). Add:

```ts
  @Post("blocks")
  async createBlock(@CurrentUser() user: JwtPayload, @Body() dto: { blockedProfileId: string }) {
    const me = await this.resolveProfileId(user.userId);
    return this.safety.createBlock(me, dto.blockedProfileId);
  }

  @Get("blocks")
  async listBlocks(@CurrentUser() user: JwtPayload) {
    const me = await this.resolveProfileId(user.userId);
    return this.safety.listBlocks(me);
  }

  @Delete("blocks/:blockedProfileId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBlock(@CurrentUser() user: JwtPayload, @Param("blockedProfileId") blocked: string) {
    const me = await this.resolveProfileId(user.userId);
    await this.safety.removeBlock(me, blocked);
  }
```

> If `safety.controller.ts` has no `resolveProfileId` helper, add a private one that does `this.prisma.profile.findUnique({ where: { userId } })` → `profile.id` (throw `NotFoundException` if absent), mirroring how other controllers resolve the caller's profile. Import `Delete`, `Param`, `HttpCode`, `HttpStatus`, `Post`, `Get`, `Body` from `@nestjs/common` as needed.

- [ ] **Step 5: Write the failing sweep test** — append to `apps/backend/src/matchmaking/matchmaking.sweep.spec.ts` (mirror the existing seeding style; the sweep now takes a `blocks: Set<string>` for its working set):

```ts
it("formation excludes a candidate blocked with the anchor", async () => {
  // anchor + 3 identical-signal candidates would form a party of 4 (min=4);
  // but one candidate is blocked with the anchor → only 3 remain → no party forms.
  // (Seed 4 same-vibe waiting entries a,b,c,d with distinct profileIds; block (a,b).)
  // Assert formed === 0 and formParty was never called.
});
```

Fill the body using the file's existing helpers for seeding waiting entries and stubbing `prisma`; provide `blocksForProfiles` returning `new Set([blockPairKey("pa", "pb")])` for the anchor `pa`.

- [ ] **Step 6: Implement sweep exclusion** — in `matchmaking.sweep.ts`, inject `SafetyService` (constructor) and use it in the formation pass. After computing `active`, load the block set once:

```ts
const blocked = await this.safety.blocksForProfiles(active.map((e) => e.profileId));
```

Then, when building the group, filter `ranked` and enforce pairwise safety against already-selected members:

```ts
const group: Entry[] = [anchor];
for (const { e } of ranked) {
  if (group.length >= this.cfg.max) break;
  const conflict = group.some((m) => blocked.has(blockPairKey(m.profileId, e.profileId)));
  if (!conflict) group.push(e);
}
if (group.length >= this.cfg.min) {
  const ok = await this.formParty(group, now);
  // ...existing removal-from-pool logic, keyed on the ids actually in `group`
}
```

Import `blockPairKey` from `@mingle/shared`. Register `SafetyService` in `MatchmakingModule` (import `SafetyModule`, which already exports `SafetyService`).

- [ ] **Step 7: Run tests to verify pass**

Run: `pnpm --filter @mingle/backend exec jest safety.service matchmaking.sweep 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"`
Expected: all PASS.

- [ ] **Step 8: Build + commit**

Run: `pnpm --filter @mingle/backend build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`

```bash
git add apps/backend/src/safety apps/backend/src/matchmaking/matchmaking.sweep.ts apps/backend/src/matchmaking/matchmaking.sweep.spec.ts apps/backend/src/matchmaking/matchmaking.module.ts
git commit -m "feat(safety): enforce blocks — isBlockedBetween + block routes + matchmaking sweep exclusion"
```

---

## Task 3: `proposal` service + REST (send / received / sent / decline)

**Files:**
- Modify: `apps/backend/src/proposal/proposal.service.ts`
- Create: `apps/backend/src/proposal/proposal.controller.ts`
- Create: `apps/backend/src/proposal/proposal.service.spec.ts`
- Modify: `apps/backend/src/proposal/proposal.module.ts`
- Modify: `apps/backend/src/notification/notification.service.ts` (extend the `type` union)
- Create: `apps/backend/src/proposal/dto/send-proposal.dto.ts`

**Interfaces:**
- Consumes: `SafetyService.isBlockedBetween`, `NotificationService.create` (proposal-received), `normalizeMatchPair` from `@mingle/shared`.
- Produces: `ProposalService.send(userId, partyId, toProfileId)`, `.listReceived(userId)`, `.listSent(userId)`, `.decline(userId, proposalId)`. **Accept is added in Task 4.** A config value `PROPOSAL_WINDOW_HOURS` (24) and `PROPOSAL_MAX_PER_PARTY` (3) read from `ConfigService`.

- [ ] **Step 1: Write the failing test** — `apps/backend/src/proposal/proposal.service.spec.ts` (mirror the `makePrisma`/`txOf` pattern from `matchmaking.service.spec.ts`):

```ts
import { BadRequestException, ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { ProposalService } from "./proposal.service";

const cfg = { get: (k: string) => ({ PROPOSAL_WINDOW_HOURS: "24", PROPOSAL_MAX_PER_PARTY: "3" }[k]) } as any;
const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
const notify = { create: jest.fn().mockResolvedValue({}) } as any;

function svcWith(prisma: any) {
  return new ProposalService(prisma, cfg, safety, notify);
}
const meProfile = { id: "pa", userId: "ua" };

it("send → 400 when proposing to self", async () => {
  const prisma = { profile: { findUnique: jest.fn().mockResolvedValue(meProfile) } } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pa")).rejects.toBeInstanceOf(BadRequestException);
});

it("send → 403 when the two are not co-participants of an eligible party", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue(null) }, // no eligible party with both
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 403 when blocked either direction", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 409 when the caller is over PROPOSAL_MAX_PER_PARTY", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(3), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  await expect(svcWith(prisma).send("ua", "party1", "pb")).rejects.toBeInstanceOf(ConflictException);
});

it("send → creates a pending proposal on the happy path", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    party: { findFirst: jest.fn().mockResolvedValue({ id: "party1", status: "active" }) },
    partyParticipant: { count: jest.fn().mockResolvedValue(2) },
    proposal: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "prop1", status: "pending" }) },
    match: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  const res = await svcWith(prisma).send("ua", "party1", "pb");
  expect(res.status).toBe("pending");
  expect(prisma.proposal.create).toHaveBeenCalled();
});

it("decline → 404 when the caller is not the recipient of a pending proposal", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue(meProfile) },
    proposal: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  } as any;
  await expect(svcWith(prisma).decline("ua", "propX")).rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/backend exec jest proposal.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | tail -15`
Expected: FAIL — methods not implemented.

- [ ] **Step 3: Implement `proposal.service.ts`**

```ts
import { Injectable, BadRequestException, ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { normalizeMatchPair } from "@mingle/shared";

@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
  ) {}

  private windowHours(): number {
    const n = Number(this.config.get("PROPOSAL_WINDOW_HOURS"));
    return Number.isFinite(n) && n > 0 ? n : 24;
  }
  private maxPerParty(): number {
    const n = Number(this.config.get("PROPOSAL_MAX_PER_PARTY"));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
  }

  private async profileId(userId: string): Promise<string> {
    const p = await this.prisma.profile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException("프로필이 없습니다");
    return p.id;
  }

  async send(userId: string, partyId: string, toProfileId: string) {
    const from = await this.profileId(userId);
    if (from === toProfileId) throw new BadRequestException("자기 자신에게는 프로포즈할 수 없습니다");

    // eligible party: status active, OR ended within the window, AND both are participants
    const cutoff = new Date(Date.now() - this.windowHours() * 3600_000);
    const party = await this.prisma.party.findFirst({
      where: {
        id: partyId,
        OR: [{ status: "active" }, { status: "ended", endedAt: { gte: cutoff } }],
        participants: { some: { profileId: from } },
      },
    });
    if (!party) throw new ForbiddenException("이 파티에서는 프로포즈할 수 없습니다");
    const bothIn = await this.prisma.partyParticipant.count({
      where: { partyId, profileId: { in: [from, toProfileId] } },
    });
    if (bothIn < 2) throw new ForbiddenException("상대가 이 파티의 참가자가 아닙니다");

    if (await this.safety.isBlockedBetween(from, toProfileId))
      throw new ForbiddenException("차단된 상대입니다");

    const [p1, p2] = normalizeMatchPair(from, toProfileId);
    if (await this.prisma.match.findUnique({ where: { profileId1_profileId2: { profileId1: p1, profileId2: p2 } } }))
      throw new ConflictException("이미 매칭된 상대입니다");

    const sent = await this.prisma.proposal.count({ where: { partyId, fromProfileId: from } });
    if (sent >= this.maxPerParty()) throw new ConflictException("이 파티의 프로포즈 한도를 초과했습니다");

    if (await this.prisma.proposal.findFirst({ where: { partyId, fromProfileId: from, toProfileId } }))
      throw new ConflictException("이미 프로포즈한 상대입니다");

    const created = await this.prisma.proposal.create({
      data: { partyId, fromProfileId: from, toProfileId, status: "pending" },
    });
    // proposal-received notification (outside any transaction)
    const recipient = await this.prisma.profile.findUnique({ where: { id: toProfileId } });
    if (recipient)
      await this.notifications.create({
        userId: recipient.userId,
        type: "proposal_received",
        title: "새 프로포즈",
        message: "누군가 당신에게 프로포즈했습니다.",
        data: { proposalId: created.id, partyId },
      });
    return created;
  }

  async listReceived(userId: string) {
    const me = await this.profileId(userId);
    return this.prisma.proposal.findMany({
      where: { toProfileId: me, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }

  async listSent(userId: string) {
    const me = await this.profileId(userId);
    return this.prisma.proposal.findMany({
      where: { fromProfileId: me },
      orderBy: { createdAt: "desc" },
    });
  }

  async decline(userId: string, proposalId: string): Promise<void> {
    const me = await this.profileId(userId);
    const res = await this.prisma.proposal.updateMany({
      where: { id: proposalId, toProfileId: me, status: "pending" },
      data: { status: "declined", respondedAt: new Date() },
    });
    if (res.count === 0) throw new NotFoundException("응답할 프로포즈가 없습니다");
    // NB: no notification to the sender — protects the recipient.
  }
}
```

> The Prisma compound-unique accessor for `Match` is `profileId1_profileId2` (from `@@unique([profileId1, profileId2])`). Confirm the generated name via `pnpm prisma:generate` output if the build complains.

- [ ] **Step 4: Create `dto/send-proposal.dto.ts`**

```ts
import { IsString, IsNotEmpty } from "class-validator";

export class SendProposalDto {
  @IsString() @IsNotEmpty() partyId!: string;
  @IsString() @IsNotEmpty() toProfileId!: string;
}
```

- [ ] **Step 5: Create `proposal.controller.ts`**

```ts
import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "../common/decorators/current-user.decorator";
import { ProposalService } from "./proposal.service";
import { SendProposalDto } from "./dto/send-proposal.dto";

@Controller("proposals")
@UseGuards(JwtAuthGuard)
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Post()
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendProposalDto) {
    return this.proposals.send(user.userId, dto.partyId, dto.toProfileId);
  }

  @Get("received")
  received(@CurrentUser() user: JwtPayload) {
    return this.proposals.listReceived(user.userId);
  }

  @Get("sent")
  sent(@CurrentUser() user: JwtPayload) {
    return this.proposals.listSent(user.userId);
  }

  @Post(":id/decline")
  @HttpCode(HttpStatus.NO_CONTENT)
  decline(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.proposals.decline(user.userId, id);
  }
}
```

- [ ] **Step 6: Extend the notification type union + wire `proposal.module.ts`**

In `apps/backend/src/notification/notification.service.ts`, extend `CreateNotificationDto.type` (used by all of Phase 4):

```ts
  type: "party_reminder" | "match_result" | "reservation" | "system" | "proposal_received" | "match_made" | "message_received";
```

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SafetyModule } from "../safety/safety.module";
import { NotificationModule } from "../notification/notification.module";
import { ProposalService } from "./proposal.service";
import { ProposalController } from "./proposal.controller";

@Module({
  imports: [PrismaModule, SafetyModule, NotificationModule],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
```

> Confirm `NotificationModule` exports `NotificationService`; if not, add it to that module's `exports`.

- [ ] **Step 7: Run tests + build to verify pass**

Run: `pnpm --filter @mingle/backend exec jest proposal.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` then the ANSI-safe build.
Expected: all PASS; build CLEAN.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/proposal apps/backend/src/notification/notification.service.ts
git commit -m "feat(proposal): send/received/sent/decline with co-participation, block, cap, dup, already-matched guards + received-notification"
```

---

## Task 4: `match` service + accept wiring

**Files:**
- Modify: `apps/backend/src/match/match.service.ts`
- Create: `apps/backend/src/match/match.service.spec.ts`
- Modify: `apps/backend/src/match/match.module.ts`
- Modify: `apps/backend/src/proposal/proposal.controller.ts` (add the accept route + inject MatchService)
- Modify: `apps/backend/src/proposal/proposal.module.ts` (import MatchModule)

**Interfaces:**
- Consumes: `normalizeMatchPair`, `blockPairKey`, `PeerProfile`, `MatchSummary` from `@mingle/shared`; `NotificationService.create`; `SafetyService.blocksForProfiles` (to hide blocked-peer rooms per spec §4.3/§6).
- Produces: `MatchService.acceptProposal(userId, proposalId): Promise<{ matchId; roomId }>`; `MatchService.listMyMatches(userId): Promise<MatchSummary[]>`.
- Constructor: `constructor(prisma: PrismaService, notifications: NotificationService, safety: SafetyService)`.

- [ ] **Step 1: Write the failing test** — `apps/backend/src/match/match.service.spec.ts`

```ts
import { NotFoundException } from "@nestjs/common";
import { blockPairKey } from "@mingle/shared";
import { MatchService } from "./match.service";

const notify = { create: jest.fn().mockResolvedValue({}) } as any;
const safety = { blocksForProfiles: jest.fn().mockResolvedValue(new Set()) } as any;

it("acceptProposal → status-guards the proposal, creates a normalized Match + room, notifies both (outside tx)", async () => {
  const proposal = { id: "prop1", partyId: "party1", fromProfileId: "pb", toProfileId: "pa" };
  const tx = {
    proposal: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue(proposal) },
    match: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "m1", profileId1: "pa", profileId2: "pb" }) },
    directMessageRoom: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "r1", matchId: "m1" }) },
  };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    match: { findUnique: jest.fn() },
  } as any;
  const svc = new MatchService(prisma, notify, safety);
  const res = await svc.acceptProposal("ua", "prop1");
  expect(res).toEqual({ matchId: "m1", roomId: "r1" });
  // normalized ordering: pa < pb  → profileId1 = "pa"
  expect(tx.match.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ profileId1: "pa", profileId2: "pb" }) }),
  );
  expect(notify.create).toHaveBeenCalledTimes(2); // both users, outside the tx
});

it("acceptProposal → 404 when the caller is not the pending recipient", async () => {
  const tx = { proposal: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  } as any;
  await expect(new MatchService(prisma, notify, safety).acceptProposal("ua", "prop1")).rejects.toBeInstanceOf(NotFoundException);
});

it("listMyMatches → hides a room whose peer is blocked", async () => {
  const prisma = {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    match: {
      findMany: jest.fn().mockResolvedValue([
        { id: "m1", profileId1: "pa", profileId2: "pb", room: { id: "r1", messages: [] }, profile1: { id: "pa" }, profile2: { id: "pb", name: "B", age: 20, gender: "female", occupation: "x", photoUrl: null, preferenceSignals: null } },
      ]),
    },
    directMessage: { count: jest.fn().mockResolvedValue(0) },
  } as any;
  const blockedSafety = { blocksForProfiles: jest.fn().mockResolvedValue(new Set([blockPairKey("pa", "pb")])) } as any;
  const res = await new MatchService(prisma, notify, blockedSafety).listMyMatches("ua");
  expect(res).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/backend exec jest match.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | tail -15`
Expected: FAIL.

- [ ] **Step 3: Implement `match.service.ts`**

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { SafetyService } from "../safety/safety.service";
import { normalizeMatchPair, blockPairKey, type MatchSummary, type PeerProfile } from "@mingle/shared";

@Injectable()
export class MatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly safety: SafetyService,
  ) {}

  async acceptProposal(userId: string, proposalId: string): Promise<{ matchId: string; roomId: string }> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const out = await this.prisma.$transaction(
          async (tx) => {
            const guarded = await tx.proposal.updateMany({
              where: { id: proposalId, toProfileId: me.id, status: "pending" },
              data: { status: "accepted", respondedAt: new Date() },
            });
            if (guarded.count === 0) throw new NotFoundException("응답할 프로포즈가 없습니다");
            const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
            if (!proposal) throw new NotFoundException("프로포즈를 찾을 수 없습니다");

            const [profileId1, profileId2] = normalizeMatchPair(proposal.fromProfileId, proposal.toProfileId);
            let match = await tx.match.findUnique({
              where: { profileId1_profileId2: { profileId1, profileId2 } },
            });
            if (!match) {
              try {
                match = await tx.match.create({
                  data: { profileId1, profileId2, partyId: proposal.partyId, proposalId: proposal.id },
                });
              } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                  match = await tx.match.findUnique({
                    where: { profileId1_profileId2: { profileId1, profileId2 } },
                  });
                } else throw e;
              }
            }
            const m = match!;
            let room = await tx.directMessageRoom.findUnique({ where: { matchId: m.id } });
            if (!room) room = await tx.directMessageRoom.create({ data: { matchId: m.id } });
            return { matchId: m.id, roomId: room.id, profileId1, profileId2 };
          },
          { isolationLevel: "Serializable" },
        );

        // notifications OUTSIDE the transaction
        for (const pid of [out.profileId1, out.profileId2]) {
          const prof = await this.prisma.profile.findUnique({ where: { id: pid } });
          if (prof)
            await this.notifications.create({
              userId: prof.userId,
              type: "match_made",
              title: "매칭 성사",
              message: "새로운 매칭이 성사되었습니다.",
              data: { matchId: out.matchId, roomId: out.roomId },
            });
        }
        return { matchId: out.matchId, roomId: out.roomId };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034" && attempt < MAX_ATTEMPTS) continue;
        throw e;
      }
    }
  }

  async listMyMatches(userId: string): Promise<MatchSummary[]> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");
    const matches = await this.prisma.match.findMany({
      where: { OR: [{ profileId1: me.id }, { profileId2: me.id }] },
      include: {
        room: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
        profile1: true,
        profile2: true,
      },
    });
    const summaries: MatchSummary[] = [];
    for (const match of matches) {
      if (!match.room) continue;
      const peerRow = match.profileId1 === me.id ? match.profile2 : match.profile1;
      const unreadCount = await this.prisma.directMessage.count({
        where: { roomId: match.room.id, senderProfileId: { not: me.id }, readAt: null },
      });
      summaries.push({
        matchId: match.id,
        roomId: match.room.id,
        peer: this.toPeer(peerRow),
        lastMessage: match.room.messages[0]
          ? { ...match.room.messages[0], createdAt: match.room.messages[0].createdAt.toISOString() }
          : undefined,
        unreadCount,
      });
    }
    // Hide rooms whose peer is blocked (either direction) — spec §4.3/§6. Match/room rows are retained.
    const blocked = await this.safety.blocksForProfiles([me.id, ...summaries.map((s) => s.peer.profileId)]);
    return summaries.filter((s) => !blocked.has(blockPairKey(me.id, s.peer.profileId)));
  }

  private toPeer(p: { id: string; name: string; age: number; gender: string; occupation: string; photoUrl: string | null; preferenceSignals: unknown }): PeerProfile {
    return {
      profileId: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      occupation: p.occupation,
      photoUrl: p.photoUrl ?? undefined,
      preferenceSummary: (p.preferenceSignals as { summary?: string } | null)?.summary ?? undefined,
    };
  }
}
```

> The `lastMessage` mapping above returns a Prisma row; the plan's Task-5 message projection helper can be reused if you prefer. Keep the peer projection identical to Phase 3's public party projection (no `riskScore`, no raw `preferenceSignals`).

- [ ] **Step 4: Add the accept route** to `proposal.controller.ts` (inject `MatchService`):

```ts
import { MatchService } from "../match/match.service";
// constructor(private readonly proposals: ProposalService, private readonly matches: MatchService) {}

  @Post(":id/accept")
  accept(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    return this.matches.acceptProposal(user.userId, id);
  }
```

(The proposal-received notification + the `CreateNotificationDto.type` union extension were done in Task 3. This task only adds the accept route + the `match_made` notification, which lives in `MatchService.acceptProposal` from Step 3.)

- [ ] **Step 5: Wire modules** — `match.module.ts` imports `PrismaModule` + `NotificationModule` + `SafetyModule`, provides+exports `MatchService`. `proposal.module.ts` additionally imports `MatchModule` (it already imports `SafetyModule` + `NotificationModule` from Task 3). (The `CreateNotificationDto.type` union was already extended in Task 3.)

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @mingle/backend exec jest match.service proposal.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` + ANSI-safe build.
Expected: PASS; CLEAN.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/match apps/backend/src/proposal
git commit -m "feat(match): accept proposal → normalized idempotent Match + DM room (Serializable) + match_made notification"
```

---

## Task 5: `messenger` service + REST + emitter seam

**Files:**
- Modify: `apps/backend/src/messenger/messenger.service.ts`
- Create: `apps/backend/src/messenger/messenger.controller.ts`
- Create: `apps/backend/src/messenger/messenger.service.spec.ts`
- Create: `apps/backend/src/messenger/messenger.emitter.ts` (interface + DI token)
- Modify: `apps/backend/src/messenger/messenger.module.ts`
- Create: `apps/backend/src/messenger/dto/send-message.dto.ts`

**Interfaces:**
- Consumes: `SafetyService.isBlockedBetween`, `NotificationService.create`, `NewMessageEvent`/`ReadEvent`/`DirectMessage` from `@mingle/shared`.
- Produces: `MessengerService.listRooms(userId)`, `.history(userId, roomId, before?, limit)`, `.send(userId, roomId, content)`, `.markRead(userId, roomId)`, `.assertMember(profileId, roomId)`. An injected `MESSENGER_EMITTER` token: `interface MessengerEmitter { emitNewMessage(e: NewMessageEvent): void; emitRead(e: ReadEvent): void; }`.

- [ ] **Step 1: Emitter seam** — `messenger/messenger.emitter.ts`

```ts
import type { NewMessageEvent, ReadEvent } from "@mingle/shared";

export const MESSENGER_EMITTER = Symbol("MESSENGER_EMITTER");

export interface MessengerEmitter {
  emitNewMessage(event: NewMessageEvent): void;
  emitRead(event: ReadEvent): void;
}
```

- [ ] **Step 2: Write the failing test** — `apps/backend/src/messenger/messenger.service.spec.ts`

```ts
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { MessengerService } from "./messenger.service";

const cfg = { get: () => "2000" } as any;
const safety = { isBlockedBetween: jest.fn().mockResolvedValue(false) } as any;
const notify = { create: jest.fn().mockResolvedValue({}) } as any;
const emitter = { emitNewMessage: jest.fn(), emitRead: jest.fn() };

const room = { id: "r1", match: { profileId1: "pa", profileId2: "pb" } };
function prismaWith(over: any = {}) {
  return {
    profile: { findUnique: jest.fn().mockResolvedValue({ id: "pa", userId: "ua" }) },
    directMessageRoom: { findUnique: jest.fn().mockResolvedValue(room) },
    directMessage: { create: jest.fn().mockResolvedValue({ id: "m1", roomId: "r1", senderProfileId: "pa", content: "hi", readAt: null, createdAt: new Date() }), updateMany: jest.fn().mockResolvedValue({ count: 2 }), findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  } as any;
}
function svc(prisma: any) {
  return new MessengerService(prisma, cfg, safety, notify, emitter);
}

it("send → 403 when the caller is not a member of the room", async () => {
  const prisma = prismaWith({ directMessageRoom: { findUnique: jest.fn().mockResolvedValue({ id: "r1", match: { profileId1: "px", profileId2: "py" } }) } });
  await expect(svc(prisma).send("ua", "r1", "hi")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 403 when blocked", async () => {
  safety.isBlockedBetween.mockResolvedValueOnce(true);
  await expect(svc(prismaWith()).send("ua", "r1", "hi")).rejects.toBeInstanceOf(ForbiddenException);
});

it("send → 400 when content is empty or too long", async () => {
  await expect(svc(prismaWith()).send("ua", "r1", "")).rejects.toBeInstanceOf(BadRequestException);
  await expect(svc(prismaWith()).send("ua", "r1", "x".repeat(2001))).rejects.toBeInstanceOf(BadRequestException);
});

it("send → persists, emits message:new, notifies the recipient", async () => {
  const prisma = prismaWith();
  const res = await svc(prisma).send("ua", "r1", "hi");
  expect(prisma.directMessage.create).toHaveBeenCalled();
  expect(emitter.emitNewMessage).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1" }));
  expect(notify.create).toHaveBeenCalledWith(expect.objectContaining({ type: "message_received" }));
  expect(res.content).toBe("hi");
});

it("markRead → sets unread read, emits room-level message:read", async () => {
  const prisma = prismaWith();
  await svc(prisma).markRead("ua", "r1");
  expect(prisma.directMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ roomId: "r1", senderProfileId: { not: "pa" }, readAt: null }) }));
  expect(emitter.emitRead).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1", readerProfileId: "pa" }));
});
```

- [ ] **Step 3: Implement `messenger.service.ts`**

```ts
import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SafetyService } from "../safety/safety.service";
import { NotificationService } from "../notification/notification.service";
import { MESSENGER_EMITTER, type MessengerEmitter } from "./messenger.emitter";
import type { DirectMessage } from "@mingle/shared";

@Injectable()
export class MessengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly safety: SafetyService,
    private readonly notifications: NotificationService,
    @Inject(MESSENGER_EMITTER) private readonly emitter: MessengerEmitter,
  ) {}

  private maxLen(): number {
    const n = Number(this.config.get("MESSAGE_MAX_LEN"));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2000;
  }

  /** Returns { me, peer } profile ids if the caller is a member; else throws 403/404. */
  private async memberContext(userId: string, roomId: string): Promise<{ me: string; peer: string }> {
    const me = await this.prisma.profile.findUnique({ where: { userId } });
    if (!me) throw new NotFoundException("프로필이 없습니다");
    const room = await this.prisma.directMessageRoom.findUnique({
      where: { id: roomId },
      include: { match: true },
    });
    if (!room) throw new NotFoundException("대화방을 찾을 수 없습니다");
    const { profileId1, profileId2 } = room.match;
    if (me.id !== profileId1 && me.id !== profileId2) throw new ForbiddenException("이 대화방의 멤버가 아닙니다");
    return { me: me.id, peer: me.id === profileId1 ? profileId2 : profileId1 };
  }

  private toDto(m: { id: string; roomId: string; senderProfileId: string; content: string; readAt: Date | null; createdAt: Date }): DirectMessage {
    return { id: m.id, roomId: m.roomId, senderProfileId: m.senderProfileId, content: m.content, readAt: m.readAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString() };
  }

  async send(userId: string, roomId: string, content: string): Promise<DirectMessage> {
    const trimmed = (content ?? "").trim();
    if (!trimmed || trimmed.length > this.maxLen()) throw new BadRequestException("메시지 길이가 올바르지 않습니다");
    const { me, peer } = await this.memberContext(userId, roomId);
    if (await this.safety.isBlockedBetween(me, peer)) throw new ForbiddenException("차단된 상대입니다");

    const row = await this.prisma.directMessage.create({
      data: { roomId, senderProfileId: me, content: trimmed },
    });
    const dto = this.toDto(row);
    this.emitter.emitNewMessage({ roomId, message: dto });
    const peerProfile = await this.prisma.profile.findUnique({ where: { id: peer } });
    if (peerProfile)
      await this.notifications.create({
        userId: peerProfile.userId,
        type: "message_received",
        title: "새 메시지",
        message: trimmed.slice(0, 80),
        data: { roomId },
      });
    return dto;
  }

  async markRead(userId: string, roomId: string): Promise<{ lastReadAt: string }> {
    const { me } = await this.memberContext(userId, roomId);
    const now = new Date();
    await this.prisma.directMessage.updateMany({
      where: { roomId, senderProfileId: { not: me }, readAt: null },
      data: { readAt: now },
    });
    const lastReadAt = now.toISOString();
    this.emitter.emitRead({ roomId, readerProfileId: me, lastReadAt });
    return { lastReadAt };
  }

  async history(userId: string, roomId: string, before: string | undefined, limit: number): Promise<DirectMessage[]> {
    await this.memberContext(userId, roomId);
    const rows = await this.prisma.directMessage.findMany({
      where: { roomId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 100),
    });
    return rows.reverse().map((m) => this.toDto(m));
  }
}
```

- [ ] **Step 4: Create `dto/send-message.dto.ts`, `messenger.controller.ts`** (routes `GET /messenger/rooms`, `GET /messenger/rooms/:id/messages`, `POST /messenger/rooms/:id/messages`, `POST /messenger/rooms/:id/read`, all `@UseGuards(JwtAuthGuard)`, caller = `user.userId`). `listRooms` delegates to `MatchService.listMyMatches` (import MatchModule) so the list is the same `MatchSummary[]`.

```ts
import { IsString, IsNotEmpty, MaxLength } from "class-validator";
export class SendMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) content!: string;
}
```

- [ ] **Step 5: Wire `messenger.module.ts`** — imports `PrismaModule`, `SafetyModule`, `NotificationModule`, `MatchModule`; providers include `MessengerService` and a **placeholder emitter** so the module boots before Task 6 wires the gateway:

```ts
providers: [
  MessengerService,
  { provide: MESSENGER_EMITTER, useValue: { emitNewMessage() {}, emitRead() {} } },
],
exports: [MessengerService, MESSENGER_EMITTER],
```

(Task 6 replaces the `useValue` no-op with the gateway.)

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @mingle/backend exec jest messenger.service 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"` + ANSI-safe build.
Expected: PASS; CLEAN.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/messenger
git commit -m "feat(messenger): rooms/history/send/room-level-read with membership+block guards + emitter seam + message notifications"
```

---

## Task 6: `MessengerGateway` (Socket.IO)

**Files:**
- Create: `apps/backend/src/messenger/messenger.gateway.ts`
- Create: `apps/backend/src/messenger/messenger.gateway.spec.ts`
- Modify: `apps/backend/src/messenger/messenger.module.ts` (provide the gateway as `MESSENGER_EMITTER`)
- Modify: `apps/backend/src/auth/auth.module.ts` (add `JwtModule` to `exports`)

**Interfaces:**
- Consumes: `JwtService` (verify handshake token), `MessengerService.assertMember` (authorize room join/typing), `TypingEvent`/`NewMessageEvent`/`ReadEvent`.
- Produces: implements `MessengerEmitter` (`emitNewMessage`/`emitRead` → `server.to(roomId).emit(...)`).

- [ ] **Step 1: Add `assertMember` to `MessengerService`** (thin public wrapper over `memberContext`, returns `boolean`):

```ts
async assertMember(userId: string, roomId: string): Promise<boolean> {
  try { await this.memberContext(userId, roomId); return true; } catch { return false; }
}
```

- [ ] **Step 2: Write the failing test** — `apps/backend/src/messenger/messenger.gateway.spec.ts`

```ts
import { MessengerGateway } from "./messenger.gateway";

const jwt = { verify: jest.fn() } as any;
const messenger = { assertMember: jest.fn() } as any;

function gatewayWith() {
  const gw = new MessengerGateway(jwt, messenger);
  (gw as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  return gw;
}

it("emitNewMessage broadcasts to the room", () => {
  const gw = gatewayWith();
  const to = (gw as any).server.to;
  gw.emitNewMessage({ roomId: "r1", message: { id: "m1" } as any });
  expect(to).toHaveBeenCalledWith("r1");
});

it("handleJoin joins only when assertMember passes", async () => {
  messenger.assertMember.mockResolvedValueOnce(true);
  const gw = gatewayWith();
  const client = { data: { userId: "ua" }, join: jest.fn(), emit: jest.fn() } as any;
  await gw.handleJoin(client, { roomId: "r1" });
  expect(client.join).toHaveBeenCalledWith("r1");
});

it("handleJoin refuses when not a member", async () => {
  messenger.assertMember.mockResolvedValueOnce(false);
  const gw = gatewayWith();
  const client = { data: { userId: "ua" }, join: jest.fn(), emit: jest.fn() } as any;
  await gw.handleJoin(client, { roomId: "r1" });
  expect(client.join).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Implement `messenger.gateway.ts`**

```ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, type OnGatewayConnection } from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { MessengerService } from "./messenger.service";
import type { MessengerEmitter } from "./messenger.emitter";
import type { NewMessageEvent, ReadEvent } from "@mingle/shared";

@WebSocketGateway({ cors: { origin: true } })
export class MessengerGateway implements MessengerEmitter, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly messenger: MessengerService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return client.disconnect();
      const payload = this.jwt.verify(token) as { sub: string };
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage("room:join")
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    if (await this.messenger.assertMember(client.data.userId, body.roomId)) client.join(body.roomId);
    else client.emit("error", { message: "forbidden" });
  }

  @SubscribeMessage("room:leave")
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    client.leave(body.roomId);
  }

  @SubscribeMessage("typing:start")
  async typingStart(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    await this.broadcastTyping(client, body.roomId, true);
  }

  @SubscribeMessage("typing:stop")
  async typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    await this.broadcastTyping(client, body.roomId, false);
  }

  private async broadcastTyping(client: Socket, roomId: string, isTyping: boolean) {
    if (!(await this.messenger.assertMember(client.data.userId, roomId))) return;
    client.to(roomId).emit("typing", { roomId, profileId: client.data.userId, isTyping });
  }

  emitNewMessage(event: NewMessageEvent): void {
    this.server.to(event.roomId).emit("message:new", event);
  }
  emitRead(event: ReadEvent): void {
    this.server.to(event.roomId).emit("message:read", event);
  }
}
```

> `client.data.userId` carries the JWT `sub` (the user id), matching how `assertMember(userId, roomId)` resolves the profile. The typing event uses `userId` as `profileId` payload only if they coincide — if the mobile needs the *profile* id for typing display, resolve it in `assertMember` and stash `client.data.profileId` on join; keep the payload's field name `profileId` and populate it from that. (Implementer: prefer stashing `profileId` on connect.)

- [ ] **Step 4: Wire the gateway as the emitter** — in `messenger.module.ts`, import `AuthModule` (now exporting `JwtModule`), replace the no-op `MESSENGER_EMITTER` `useValue` with:

```ts
providers: [
  MessengerService,
  MessengerGateway,
  { provide: MESSENGER_EMITTER, useExisting: MessengerGateway },
],
```

In `auth.module.ts`, change `exports: [AuthService]` → `exports: [AuthService, JwtModule]`.

- [ ] **Step 5: Run tests + build + boot**

Run: `pnpm --filter @mingle/backend exec jest messenger 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "Tests:|FAIL"`, the ANSI-safe build, then boot: `docker compose up -d && (cd apps/backend && node -e "require('child_process').execSync('node dist/main.js',{timeout:8000,stdio:'inherit'})")` — expect `MessengerModule dependencies initialized` + `Nest application successfully started`; then `pkill -f "node dist/main.js"`.
Expected: PASS; CLEAN; boots (gateway attaches to the HTTP server).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/messenger apps/backend/src/auth/auth.module.ts
git commit -m "feat(messenger): Socket.IO gateway — handshake auth, room-join authz, typing, message/read broadcast"
```

---

## Task 7: `@mingle/client-core` APIs + socket wrapper

**Files:**
- Create: `packages/client-core/src/api/proposals.ts`, `api/matches.ts`, `api/messenger.ts`, `api/blocks.ts`
- Create: `packages/client-core/src/socket/messenger-socket.ts`
- Create: `packages/client-core/src/__tests__/social-api.test.ts`
- Modify: `packages/client-core/src/index.ts`

**Interfaces:**
- Consumes: `apiFetch` from `../api/client.js`; types from `@mingle/shared`.
- Produces: `sendProposal(partyId, toProfileId)`, `getReceivedProposals()`, `acceptProposal(id)`, `declineProposal(id)`; `getMatches()`, `getRoomMessages(roomId, before?)`, `sendMessage(roomId, content)`, `markRoomRead(roomId)`; `createBlock(blockedProfileId)`, `getBlocks()`, `removeBlock(blockedProfileId)`; `connectMessengerSocket({ ioFactory, token, baseUrl, handlers })`.

- [ ] **Step 1: Write the failing test** — `packages/client-core/src/__tests__/social-api.test.ts` (mirror `matchmaking-api.test.ts`: `configureClient` + `setTokenAccessor` from `../config.js`, `vi.stubGlobal("fetch", ...)`):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendProposal, acceptProposal } from "../api/proposals.js";
import { sendMessage } from "../api/messenger.js";
import { configureClient, setTokenAccessor } from "../config.js";

describe("social api", () => {
  beforeEach(() => { configureClient({ baseUrl: "http://api.test" }); setTokenAccessor(() => "t"); });
  afterEach(() => vi.unstubAllGlobals());

  it("sendProposal POSTs /proposals with the body", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "p1", status: "pending" }) } as Response);
    vi.stubGlobal("fetch", f);
    await sendProposal("party1", "pb");
    expect(f.mock.calls[0][0]).toBe("http://api.test/proposals");
    expect(f.mock.calls[0][1]?.method).toBe("POST");
  });

  it("acceptProposal POSTs /proposals/:id/accept", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ matchId: "m1", roomId: "r1" }) } as Response);
    vi.stubGlobal("fetch", f);
    const res = await acceptProposal("p1");
    expect(f.mock.calls[0][0]).toBe("http://api.test/proposals/p1/accept");
    expect(res.roomId).toBe("r1");
  });

  it("sendMessage POSTs the room message endpoint", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "m1", content: "hi" }) } as Response);
    vi.stubGlobal("fetch", f);
    await sendMessage("r1", "hi");
    expect(f.mock.calls[0][0]).toBe("http://api.test/messenger/rooms/r1/messages");
    expect(f.mock.calls[0][1]?.method).toBe("POST");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mingle/client-core exec vitest run src/__tests__/social-api.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement the API modules** — e.g. `api/proposals.ts`:

```ts
import type { Proposal, ProposalView } from "@mingle/shared";
import { apiFetch } from "./client.js";

export function sendProposal(partyId: string, toProfileId: string): Promise<Proposal> {
  return apiFetch<Proposal>("/proposals", { method: "POST", body: JSON.stringify({ partyId, toProfileId }) });
}
export function getReceivedProposals(): Promise<ProposalView[]> {
  return apiFetch<ProposalView[]>("/proposals/received");
}
export function acceptProposal(id: string): Promise<{ matchId: string; roomId: string }> {
  return apiFetch<{ matchId: string; roomId: string }>(`/proposals/${id}/accept`, { method: "POST" });
}
export function declineProposal(id: string): Promise<void> {
  return apiFetch<void>(`/proposals/${id}/decline`, { method: "POST" });
}
```

`api/matches.ts` (`getMatches → GET /messenger/rooms`), `api/messenger.ts` (`getRoomMessages → GET /messenger/rooms/:id/messages?before=`, `sendMessage → POST …/messages`, `markRoomRead → POST …/read`), `api/blocks.ts` (`createBlock → POST /safety/blocks`, `getBlocks → GET /safety/blocks`, `removeBlock → DELETE /safety/blocks/:id`) follow the identical `apiFetch` pattern with types from `@mingle/shared`.

- [ ] **Step 4: Implement `socket/messenger-socket.ts`** (injected `io` to keep the package platform-agnostic — mirrors the `tokenAccessor` injection):

```ts
import type { NewMessageEvent, ReadEvent, TypingEvent } from "@mingle/shared";

export interface MessengerSocketHandlers {
  onMessage?: (e: NewMessageEvent) => void;
  onRead?: (e: ReadEvent) => void;
  onTyping?: (e: TypingEvent) => void;
}
export interface MessengerSocketHandle {
  joinRoom(roomId: string): void;
  leaveRoom(roomId: string): void;
  setTyping(roomId: string, isTyping: boolean): void;
  disconnect(): void;
}

/** `ioFactory` is `socket.io-client`'s `io` (injected by the platform). */
export function connectMessengerSocket(opts: {
  ioFactory: (url: string, options: unknown) => any;
  baseUrl: string;
  token: string;
  handlers: MessengerSocketHandlers;
}): MessengerSocketHandle {
  const socket = opts.ioFactory(opts.baseUrl, { auth: { token: opts.token }, transports: ["websocket"] });
  const { onMessage, onRead, onTyping } = opts.handlers;
  if (onMessage) socket.on("message:new", onMessage);
  if (onRead) socket.on("message:read", onRead);
  if (onTyping) socket.on("typing", onTyping);
  return {
    joinRoom: (roomId) => socket.emit("room:join", { roomId }),
    leaveRoom: (roomId) => socket.emit("room:leave", { roomId }),
    setTyping: (roomId, isTyping) => socket.emit(isTyping ? "typing:start" : "typing:stop", { roomId }),
    disconnect: () => socket.disconnect(),
  };
}
```

- [ ] **Step 5: Barrel** — add all API functions + `connectMessengerSocket` + the socket types to `packages/client-core/src/index.ts` (follow the existing `export … from "./api/<file>.js"` convention; the socket file is `./socket/messenger-socket.js`).

- [ ] **Step 6: Run tests + build**

Run: `pnpm --filter @mingle/client-core exec vitest run` + `pnpm --filter @mingle/client-core build 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -iE "error" || echo CLEAN`.
Expected: PASS; CLEAN.

- [ ] **Step 7: Commit**

```bash
git add packages/client-core/src
git commit -m "feat(client-core): proposals/matches/messenger/blocks APIs + injected Socket.IO wrapper"
```

---

## Task 8: Mobile screens (proposals, chats, chat room, party entry)

**Files:**
- Create: `apps/mobile/app/(app)/proposals.tsx`, `app/(app)/chats.tsx`, `app/(app)/chat/[roomId].tsx`
- Create: `apps/mobile/src/lib/messenger-socket.ts`
- Modify: `apps/mobile/app/(app)/party/[id].tsx` (add "프로포즈 보내기" per participant)
- Modify: `apps/mobile/package.json` (add `socket.io-client`)

**Interfaces:**
- Consumes: client-core `getReceivedProposals`/`acceptProposal`/`declineProposal`/`sendProposal`/`getMatches`/`getRoomMessages`/`sendMessage`/`markRoomRead`/`connectMessengerSocket`; `useAuthStore` token.

- [ ] **Step 1: Add the dependency** — in `apps/mobile/package.json` add `"socket.io-client": "^4.8.3"` to `dependencies`; run `pnpm install` at the repo root (keeps `node-linker=hoisted`).

- [ ] **Step 2: Socket wiring** — `apps/mobile/src/lib/messenger-socket.ts`

```ts
import { io } from "socket.io-client";
import { connectMessengerSocket, type MessengerSocketHandlers } from "@mingle/client-core";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function openMessengerSocket(token: string, handlers: MessengerSocketHandlers) {
  return connectMessengerSocket({ ioFactory: io as never, baseUrl: BASE, token, handlers });
}
```

- [ ] **Step 3: Received proposals screen** — `app/(app)/proposals.tsx`: `useEffect` loads `getReceivedProposals()`; each row shows the peer projection + 수락/거절 buttons calling `acceptProposal(id)` (→ `router.push(\`/(app)/chat/${res.roomId}\`)`) / `declineProposal(id)` (→ remove from list). Use the doodle B&W styles established in `onboarding.tsx`/`matching.tsx` (no color; ink `#17150F` on paper `#FFFFFF`). Guard against unmounted setState with the existing `alive` ref pattern.

- [ ] **Step 4: Chats list** — `app/(app)/chats.tsx`: loads `getMatches()` → `MatchSummary[]`; each row = peer name + last message + unread badge; tap → `router.push(\`/(app)/chat/${roomId}\`)`.

- [ ] **Step 5: Chat room** — `app/(app)/chat/[roomId].tsx`:
  - Load history via `getRoomMessages(roomId)`; render a `FlatList` (inverted).
  - On mount: `openMessengerSocket(token, { onMessage, onRead, onTyping })` → `joinRoom(roomId)`; append `message:new`, mark peer read on `message:read` (room-level: mark all my sent messages ≤ `lastReadAt` as "읽음"), show a typing indicator on `typing`.
  - On focus / new incoming: call `markRoomRead(roomId)`.
  - Compose bar: `sendMessage(roomId, text)`; emit `setTyping(roomId, true/false)` with a ~3s idle auto-stop.
  - Cleanup: `leaveRoom` + `disconnect` on unmount (mirror `matching.tsx`'s `timerRef`/`alive` discipline).
  - Header: 차단/신고 entry calling `createBlock(peerProfileId)` (then leave the room).

- [ ] **Step 6: Party entry** — in `app/(app)/party/[id].tsx`, add a "프로포즈 보내기" button per participant (excluding self) calling `sendProposal(partyId, participant.profileId)`; on `ApiError` show the server message (409/403 copy).

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @mingle/mobile exec tsc --noEmit 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | grep -E "error TS|Found [0-9]+ error" || echo CLEAN`
Expected: CLEAN. (If typed-routes complain about the new routes, they are valid Expo Router file routes — regenerate `.expo/types` by running `expo` once; use the typed object form for the dynamic `chat/[roomId]` route: `router.push({ pathname: "/(app)/chat/[roomId]", params: { roomId } })`.)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): proposals + chats list + realtime chat room + party propose entry"
```

---

## Final Verification (before whole-branch review)

- [ ] `pnpm --filter @mingle/shared build` → CLEAN; `pnpm --filter @mingle/backend build` → CLEAN + `jest` all green + boots (MessengerModule + gateway); `pnpm --filter @mingle/client-core build` + `vitest` green; `pnpm --filter @mingle/mobile exec tsc --noEmit` → CLEAN.
- [ ] E2E (live, two users): party → A proposes to B (guards) → B accepts → single normalized Match + room → realtime `message:new` both ways → room-level read → typing → B blocks A ⇒ proposal/DM refused + the pair excluded from the next sweep-formed party → decline is silent.
- [ ] Confirm no `riskScore` / raw `preferenceSignals` in any proposal/match/messenger response (peer projection only).
